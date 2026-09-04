cmake_minimum_required(VERSION 3.20)

project(cad_step_to_glb LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenCASCADE REQUIRED)

add_executable(cad-step-to-glb
  src/main.cpp
)

target_include_directories(cad-step-to-glb PRIVATE
  ${OpenCASCADE_INCLUDE_DIR}
)

target_link_libraries(cad-step-to-glb PRIVATE
  TKernel
  TKMath
  TKG2d
  TKG3d
  TKGeomBase
  TKBRep
  TKGeomAlgo
  TKTopAlgo
  TKMesh
  TKCDF
  TKLCAF
  TKCAF
  TKXCAF
  TKXSBase
  TKDE
  TKDESTEP
  TKRWMesh
  TKDEGLTF
)
