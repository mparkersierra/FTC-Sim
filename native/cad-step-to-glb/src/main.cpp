#include <Bnd_Box.hxx>
#include <BRepBndLib.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <IFSelect_ReturnStatus.hxx>
#include <Message_ProgressRange.hxx>
#include <RWGltf_CafWriter.hxx>
#include <STEPCAFControl_Reader.hxx>
#include <TCollection_AsciiString.hxx>
#include <TCollection_ExtendedString.hxx>
#include <TColStd_IndexedDataMapOfStringString.hxx>
#include <TDF_Label.hxx>
#include <TDF_LabelSequence.hxx>
#include <TDataStd_Name.hxx>
#include <TDocStd_Document.hxx>
#include <XCAFApp_Application.hxx>
#include <XCAFDoc_DocumentTool.hxx>
#include <XCAFDoc_ShapeTool.hxx>
#include <TopoDS_Shape.hxx>

#include <algorithm>
#include <filesystem>
#include <functional>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <chrono>
#include <atomic>
#include <thread>
#include <utility>
#include <unordered_set>

namespace fs = std::filesystem;

static void createParentDirectories(const std::string& path) {
  fs::path parent = fs::path(path).parent_path();
  if (!parent.empty()) {
    fs::create_directories(parent);
  }
}

struct Args {
  std::string input;
  std::string output;
  std::string manifest;
  std::string inspectTree;
  bool importColors = false;
  bool importLayers = false;
  bool importProperties = false;
  bool preview = false;
  double minBboxMm = 0;
  double linearDeflection = 0.1;
  double angularDeflection = 0.523599;
  int selectionDepth = 1;
  std::vector<std::string> skipPatterns;
  std::vector<std::string> expandPatterns = {"chassis"};
};

class StageTimer {
 public:
  explicit StageTimer(std::string stage)
      : stage_(std::move(stage)), startedAt_(std::chrono::steady_clock::now()) {
    std::cout << "[occt] start " << stage_ << std::endl;
    heartbeat_ = std::thread([this]() {
      while (!done_.load()) {
        std::this_thread::sleep_for(std::chrono::seconds(10));
        if (!done_.load()) {
          auto elapsed = std::chrono::steady_clock::now() - startedAt_;
          auto seconds = std::chrono::duration_cast<std::chrono::seconds>(elapsed).count();
          std::cout << "[occt] still " << stage_ << " elapsed=" << seconds << "s" << std::endl;
        }
      }
    });
  }

  ~StageTimer() {
    done_.store(true);
    if (heartbeat_.joinable()) {
      heartbeat_.join();
    }
    auto elapsed = std::chrono::steady_clock::now() - startedAt_;
    auto millis = std::chrono::duration_cast<std::chrono::milliseconds>(elapsed).count();
    std::cout << "[occt] finish " << stage_ << " elapsed=" << millis << "ms" << std::endl;
  }

 private:
  std::string stage_;
  std::chrono::steady_clock::time_point startedAt_;
  std::atomic<bool> done_{false};
  std::thread heartbeat_;
};

static std::string trimCopy(const std::string& value) {
  std::size_t start = value.find_first_not_of(" \t\r\n");
  if (start == std::string::npos) {
    return "";
  }

  std::size_t end = value.find_last_not_of(" \t\r\n");
  return value.substr(start, end - start + 1);
}

static Args parseArgs(int argc, char** argv) {
  Args args;

  for (int index = 1; index < argc; ++index) {
    std::string key = argv[index];
    if (key == "--input" && index + 1 < argc) {
      args.input = argv[++index];
    } else if (key == "--output" && index + 1 < argc) {
      args.output = argv[++index];
    } else if (key == "--manifest" && index + 1 < argc) {
      args.manifest = argv[++index];
    } else if (key == "--inspect-tree" && index + 1 < argc) {
      args.inspectTree = argv[++index];
    } else if (key == "--colors") {
      args.importColors = true;
    } else if (key == "--layers") {
      args.importLayers = true;
    } else if (key == "--properties") {
      args.importProperties = true;
    } else if (key == "--preview") {
      args.preview = true;
      args.minBboxMm = std::max(args.minBboxMm, 10.0);
      args.linearDeflection = 2.0;
      args.angularDeflection = 1.2;
      args.skipPatterns.insert(
          args.skipPatterns.end(),
          {"hardware", "label", "motor", "servo", "connector", "screw", "bolt", "nut", "washer", "spacer", "standoff", "bearing", "thread", "fastener", "pin", "snap ring"});
    } else if (key == "--skip-pattern" && index + 1 < argc) {
      std::stringstream stream(argv[++index]);
      std::string item;
      while (std::getline(stream, item, ',')) {
        std::string trimmed = trimCopy(item);
        if (!trimmed.empty()) {
          args.skipPatterns.push_back(trimmed);
        }
      }
    } else if (key == "--expand-pattern" && index + 1 < argc) {
      args.expandPatterns.clear();
      std::stringstream stream(argv[++index]);
      std::string item;
      while (std::getline(stream, item, ',')) {
        std::string trimmed = trimCopy(item);
        if (!trimmed.empty()) {
          args.expandPatterns.push_back(trimmed);
        }
      }
    } else if (key == "--min-bbox" && index + 1 < argc) {
      args.minBboxMm = std::stod(argv[++index]);
    } else if (key == "--linear-deflection" && index + 1 < argc) {
      args.linearDeflection = std::stod(argv[++index]);
    } else if (key == "--angular-deflection" && index + 1 < argc) {
      args.angularDeflection = std::stod(argv[++index]);
    } else if (key == "--selection-depth" && index + 1 < argc) {
      args.selectionDepth = std::max(1, std::stoi(argv[++index]));
    } else {
      throw std::runtime_error("Unknown or incomplete argument: " + key);
    }
  }

  if (args.input.empty() || (args.inspectTree.empty() && (args.output.empty() || args.manifest.empty()))) {
    throw std::runtime_error("usage: cad-step-to-glb --input robot.step --output robot.glb --manifest manifest.tsv OR --inspect-tree tree.txt");
  }

  return args;
}

static std::string lowerCopy(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
    return static_cast<char>(std::tolower(ch));
  });
  return value;
}

static std::string toUtf8(const TCollection_ExtendedString& value) {
  TCollection_AsciiString ascii(value, '?');
  return ascii.ToCString();
}

static std::string labelName(const TDF_Label& label, const std::string& fallback) {
  Handle(TDataStd_Name) name;
  if (label.FindAttribute(TDataStd_Name::GetID(), name)) {
    std::string value = toUtf8(name->Get());
    if (!value.empty()) {
      return value;
    }
  }

  return fallback;
}

static std::string sanitizeNodeName(const std::string& value, const std::string& fallback) {
  std::string sanitized;
  sanitized.reserve(value.size());

  for (char ch : value) {
    bool ok =
        (ch >= 'a' && ch <= 'z') ||
        (ch >= 'A' && ch <= 'Z') ||
        (ch >= '0' && ch <= '9') ||
        ch == '_' ||
        ch == '-' ||
        ch == '.';
    sanitized.push_back(ok ? ch : '_');
  }

  while (!sanitized.empty() && sanitized.front() == '_') {
    sanitized.erase(sanitized.begin());
  }

  while (!sanitized.empty() && sanitized.back() == '_') {
    sanitized.pop_back();
  }

  return sanitized.empty() ? fallback : sanitized;
}

static double bboxMaxDimension(const TopoDS_Shape& shape) {
  if (shape.IsNull()) {
    return 0;
  }

  Bnd_Box box;
  BRepBndLib::Add(shape, box);

  if (box.IsVoid()) {
    return 0;
  }

  Standard_Real xmin = 0;
  Standard_Real ymin = 0;
  Standard_Real zmin = 0;
  Standard_Real xmax = 0;
  Standard_Real ymax = 0;
  Standard_Real zmax = 0;
  box.Get(xmin, ymin, zmin, xmax, ymax, zmax);

  return std::max({xmax - xmin, ymax - ymin, zmax - zmin});
}

static bool matchesSkipPattern(const std::string& name, const std::vector<std::string>& patterns) {
  std::string lowerName = lowerCopy(name);

  for (const std::string& pattern : patterns) {
    std::string lowerPattern = lowerCopy(trimCopy(pattern));
    if (!lowerPattern.empty() && lowerName.find(lowerPattern) != std::string::npos) {
      return true;
    }
  }

  return false;
}

static std::string compactMatchText(const std::string& value) {
  std::string compact;
  for (char ch : lowerCopy(value)) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      compact.push_back(ch);
    }
  }
  return compact;
}

static bool matchesExpandPattern(const std::string& name, const std::vector<std::string>& patterns) {
  std::string compactName = compactMatchText(name);

  for (const std::string& pattern : patterns) {
    std::string compactPattern = compactMatchText(pattern);
    if (!compactPattern.empty() && compactName.find(compactPattern) != std::string::npos) {
      return true;
    }
  }

  return false;
}

static bool shouldSkipLabel(
    const Handle(XCAFDoc_ShapeTool)& shapeTool,
    const TDF_Label& label,
    const Args& args,
    const std::string& fallbackName) {
  std::string name = labelName(label, fallbackName);
  if (matchesSkipPattern(name, args.skipPatterns)) {
    return true;
  }

  TopoDS_Shape shape = shapeTool->GetShape(label);
  return args.minBboxMm > 0 && bboxMaxDimension(shape) > 0 && bboxMaxDimension(shape) < args.minBboxMm;
}

static int filterComponents(
    const Handle(XCAFDoc_ShapeTool)& shapeTool,
    const TDF_Label& label,
    const Args& args) {
  int removed = 0;
  TDF_LabelSequence components;

  if (!shapeTool->GetComponents(label, components)) {
    return removed;
  }

  for (Standard_Integer index = 1; index <= components.Length(); ++index) {
    TDF_Label component = components.Value(index);
    TDF_Label referred;
    TDF_Label partLabel = shapeTool->GetReferredShape(component, referred) ? referred : component;
    std::string fallbackName = "part_" + std::to_string(index);
    std::string componentName = labelName(component, labelName(partLabel, fallbackName));

    if (shouldSkipLabel(shapeTool, partLabel, args, componentName)) {
      shapeTool->RemoveShape(component, Standard_True);
      ++removed;
      continue;
    }

    removed += filterComponents(shapeTool, partLabel, args);
  }

  return removed;
}

static void meshLabelShapes(const Handle(XCAFDoc_ShapeTool)& shapeTool, const TDF_Label& label, const Args& args) {
  TopoDS_Shape shape = shapeTool->GetShape(label);
  if (!shape.IsNull()) {
    BRepMesh_IncrementalMesh mesh(
        shape,
        args.linearDeflection,
        Standard_False,
        args.angularDeflection,
        Standard_True);
    mesh.Perform();
  }

  TDF_LabelSequence components;
  if (shapeTool->GetComponents(label, components)) {
    for (Standard_Integer index = 1; index <= components.Length(); ++index) {
      TDF_Label referred;
      if (shapeTool->GetReferredShape(components.Value(index), referred)) {
        meshLabelShapes(shapeTool, referred, args);
      }
    }
  }
}

static int countLabels(const Handle(XCAFDoc_ShapeTool)& shapeTool, const TDF_Label& label) {
  int count = 1;
  TDF_LabelSequence components;
  if (shapeTool->GetComponents(label, components)) {
    for (Standard_Integer index = 1; index <= components.Length(); ++index) {
      TDF_Label referred;
      if (shapeTool->GetReferredShape(components.Value(index), referred)) {
        count += countLabels(shapeTool, referred);
      } else {
        count += 1;
      }
    }
  }

  return count;
}

static void writeTreeNode(
    std::ofstream& tree,
    const Handle(XCAFDoc_ShapeTool)& shapeTool,
    const TDF_Label& label,
    int depth,
    const std::string& fallbackName) {
  std::string indent(static_cast<std::size_t>(depth) * 2, ' ');
  std::string name = labelName(label, fallbackName);
  TopoDS_Shape shape = shapeTool->GetShape(label);
  TDF_LabelSequence components;
  bool hasComponents = shapeTool->GetComponents(label, components);

  tree << indent
       << "- depth=" << depth
       << " name=\"" << name << "\""
       << " sanitized=\"" << sanitizeNodeName(name, fallbackName) << "\""
       << " bboxMax=" << bboxMaxDimension(shape)
       << " hasShape=" << (shape.IsNull() ? "false" : "true")
       << " components=" << (hasComponents ? components.Length() : 0)
       << "\n";

  if (!hasComponents) {
    return;
  }

  for (Standard_Integer index = 1; index <= components.Length(); ++index) {
    TDF_Label component = components.Value(index);
    TDF_Label referred;
    TDF_Label next = shapeTool->GetReferredShape(component, referred) ? referred : component;
    std::string componentName = labelName(component, labelName(next, "part_" + std::to_string(index)));
    writeTreeNode(tree, shapeTool, next, depth + 1, componentName);
  }
}

static void writeInspectTree(
    const Handle(XCAFDoc_ShapeTool)& shapeTool,
    const TDF_LabelSequence& roots,
    const std::string& treePath) {
  createParentDirectories(treePath);
  std::ofstream tree(treePath);
  if (!tree) {
    throw std::runtime_error("Unable to write inspect tree: " + treePath);
  }

  tree << "STEP hierarchy\n";
  tree << "rootShapes=" << roots.Length() << "\n";

  for (Standard_Integer index = 1; index <= roots.Length(); ++index) {
    writeTreeNode(tree, shapeTool, roots.Value(index), 0, "root_" + std::to_string(index));
  }

  std::cout << "[occt] wrote inspect tree path=" << treePath << std::endl;
}

static void writeManifest(
    const Handle(XCAFDoc_ShapeTool)& shapeTool,
    const TDF_LabelSequence& roots,
    const std::string& manifestPath,
    const Args& args) {
  createParentDirectories(manifestPath);
  std::ofstream manifest(manifestPath);
  if (!manifest) {
    throw std::runtime_error("Unable to write manifest: " + manifestPath);
  }

  std::unordered_set<std::string> usedNodeNames;
  int partIndex = 1;

  auto writePart = [&](const TDF_Label& label, const std::string& fallback) {
    std::string displayName = labelName(label, fallback);
    if (matchesSkipPattern(displayName, args.skipPatterns)) {
      return;
    }

    std::string nodeName = sanitizeNodeName(displayName, fallback);

    if (usedNodeNames.count(nodeName) > 0) {
      nodeName += "_" + std::to_string(partIndex);
    }

    usedNodeNames.insert(nodeName);
    manifest << displayName << '\t' << nodeName << '\n';
    ++partIndex;
  };

  for (Standard_Integer rootIndex = 1; rootIndex <= roots.Length(); ++rootIndex) {
    TDF_Label root = roots.Value(rootIndex);
    TDF_LabelSequence components;

    if (!shapeTool->GetComponents(root, components)) {
      writePart(root, "root_" + std::to_string(rootIndex));
      continue;
    }

    for (Standard_Integer componentIndex = 1; componentIndex <= components.Length(); ++componentIndex) {
      TDF_Label component = components.Value(componentIndex);
      TDF_Label referred;
      TDF_Label partLabel = shapeTool->GetReferredShape(component, referred) ? referred : component;
      std::string fallback = "part_" + std::to_string(partIndex);
      std::string componentName = labelName(component, labelName(partLabel, fallback));

      if (matchesSkipPattern(componentName, args.skipPatterns)) {
        continue;
      }

      if (matchesExpandPattern(componentName, args.expandPatterns)) {
        TDF_LabelSequence chassisComponents;
        if (shapeTool->GetComponents(partLabel, chassisComponents)) {
          for (Standard_Integer chassisIndex = 1; chassisIndex <= chassisComponents.Length(); ++chassisIndex) {
            TDF_Label chassisComponent = chassisComponents.Value(chassisIndex);
            TDF_Label chassisReferred;
            TDF_Label chassisPart =
                shapeTool->GetReferredShape(chassisComponent, chassisReferred) ? chassisReferred : chassisComponent;
            writePart(chassisComponent, labelName(chassisPart, "part_" + std::to_string(partIndex)));
          }
        }
      } else {
        writePart(component, labelName(partLabel, fallback));
      }
    }
  }

  std::cout << "[occt] manifest parts=" << (partIndex - 1) << " path=" << manifestPath << std::endl;
}

int main(int argc, char** argv) {
  try {
    Args args = parseArgs(argc, argv);
    if (!args.output.empty()) {
      createParentDirectories(args.output);
    }
    std::cout << "[occt] input=" << args.input << std::endl;
    if (!args.output.empty()) {
      std::cout << "[occt] output=" << args.output << std::endl;
    }
    if (!args.manifest.empty()) {
      std::cout << "[occt] manifest=" << args.manifest << std::endl;
    }
    if (!args.inspectTree.empty()) {
      std::cout << "[occt] inspectTree=" << args.inspectTree << std::endl;
    }
    std::cout << "[occt] importNames=true"
              << " importColors=" << (args.importColors ? "true" : "false")
              << " importLayers=" << (args.importLayers ? "true" : "false")
              << " importProperties=" << (args.importProperties ? "true" : "false")
              << " preview=" << (args.preview ? "true" : "false")
              << " minBboxMm=" << args.minBboxMm
              << " linearDeflection=" << args.linearDeflection
              << " angularDeflection=" << args.angularDeflection
              << " selectionDepth=" << args.selectionDepth
              << std::endl;
    if (!args.skipPatterns.empty()) {
      std::cout << "[occt] skipPatterns=";
      for (std::size_t index = 0; index < args.skipPatterns.size(); ++index) {
        std::cout << (index == 0 ? "" : ",") << args.skipPatterns[index];
      }
      std::cout << std::endl;
    }
    if (!args.expandPatterns.empty()) {
      std::cout << "[occt] expandPatterns=";
      for (std::size_t index = 0; index < args.expandPatterns.size(); ++index) {
        std::cout << (index == 0 ? "" : ",") << args.expandPatterns[index];
      }
      std::cout << std::endl;
    }

    Handle(TDocStd_Document) document;
    Handle(XCAFApp_Application) application = XCAFApp_Application::GetApplication();
    application->NewDocument("MDTV-XCAF", document);

    STEPCAFControl_Reader reader;
    reader.SetColorMode(args.importColors ? Standard_True : Standard_False);
    reader.SetNameMode(Standard_True);
    reader.SetLayerMode(args.importLayers ? Standard_True : Standard_False);
    reader.SetPropsMode(args.importProperties ? Standard_True : Standard_False);

    {
      StageTimer timer("read STEP file");
      IFSelect_ReturnStatus readStatus = reader.ReadFile(args.input.c_str());
      if (readStatus != IFSelect_RetDone) {
        throw std::runtime_error("OpenCascade failed to read STEP file: " + args.input);
      }
    }

    {
      StageTimer timer("transfer STEP to XDE document");
      if (!reader.Transfer(document)) {
        throw std::runtime_error("OpenCascade failed to transfer STEP data into XDE document.");
      }
    }

    Handle(XCAFDoc_ShapeTool) shapeTool = XCAFDoc_DocumentTool::ShapeTool(document->Main());
    TDF_LabelSequence roots;
    shapeTool->GetFreeShapes(roots);

    if (roots.IsEmpty()) {
      throw std::runtime_error("STEP file produced no root shapes.");
    }

    if (args.preview || args.minBboxMm > 0 || !args.skipPatterns.empty()) {
      StageTimer timer("filter components");
      int removed = 0;
      for (Standard_Integer index = 1; index <= roots.Length(); ++index) {
        removed += filterComponents(shapeTool, roots.Value(index), args);
      }
      std::cout << "[occt] filteredComponents=" << removed << std::endl;
    }

    std::cout << "[occt] rootShapes=" << roots.Length() << std::endl;
    int labelCount = 0;
    for (Standard_Integer index = 1; index <= roots.Length(); ++index) {
      labelCount += countLabels(shapeTool, roots.Value(index));
    }
    std::cout << "[occt] approximateLabelCount=" << labelCount << std::endl;

    if (!args.inspectTree.empty()) {
      StageTimer timer("write inspect tree");
      writeInspectTree(shapeTool, roots, args.inspectTree);
      return 0;
    }

    {
      StageTimer timer("mesh shapes");
      for (Standard_Integer index = 1; index <= roots.Length(); ++index) {
        std::cout << "[occt] meshing root " << index << "/" << roots.Length() << std::endl;
        meshLabelShapes(shapeTool, roots.Value(index), args);
      }
    }

    {
      StageTimer timer("write manifest");
      writeManifest(shapeTool, roots, args.manifest, args);
    }

    TColStd_IndexedDataMapOfStringString fileInfo;
    fileInfo.Add("Generator", "cad-motion-prototype OpenCascade converter");

    {
      StageTimer timer("write GLB");
      RWGltf_CafWriter writer(TCollection_AsciiString(args.output.c_str()), Standard_True);
      if (!writer.Perform(document, fileInfo, Message_ProgressRange())) {
        throw std::runtime_error("OpenCascade failed to write GLB file: " + args.output);
      }
    }

    std::cout << "[occt] done" << std::endl;

    return 0;
  } catch (const std::exception& exception) {
    std::cerr << exception.what() << std::endl;
    return 1;
  }
}
