package com.mparkersierra.ftcsim.runner.input;

import com.mparkersierra.ftcsim.runner.opmode.OpModeManager;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.Gamepad;

import java.util.HashSet;
import java.util.Set;

public class BrowserGamepadController {
    private final OpModeManager opModeManager;
    private final Set<String> pressedControls = new HashSet<>();

    public BrowserGamepadController(OpModeManager opModeManager) {
        this.opModeManager = opModeManager;
    }

    public void handleInput(String key, boolean pressed) {
        switch (key.toLowerCase()) {
            case "w":
                handleGamepadInput(1, "left_stick_up", pressed);
                break;
            case "s":
                handleGamepadInput(1, "left_stick_down", pressed);
                break;
            case "a":
                handleGamepadInput(1, "left_stick_left", pressed);
                break;
            case "d":
                handleGamepadInput(1, "left_stick_right", pressed);
                break;
            case "arrowup":
                handleGamepadInput(1, "right_stick_up", pressed);
                break;
            case "arrowdown":
                handleGamepadInput(1, "right_stick_down", pressed);
                break;
            case "arrowleft":
                handleGamepadInput(1, "right_stick_left", pressed);
                break;
            case "arrowright":
                handleGamepadInput(1, "right_stick_right", pressed);
                break;
            default:
                return;
        }
    }

    public void handleGamepadInput(int gamepadNumber, String control, boolean pressed) {
        LinearOpMode opMode = opModeManager.getCurrentOpMode();
        if (opMode == null) return;

        String id = gamepadNumber + ":" + control;

        if (pressed) {
            pressedControls.add(id);
        } else {
            pressedControls.remove(id);
        }

        applyGamepad(opMode.gamepad1, 1);
        applyGamepad(opMode.gamepad2, 2);
    }

    private void applyGamepad(Gamepad gamepad, int gamepadNumber) {
        gamepad.resetButtons();

        gamepad.left_stick_y = axis(gamepadNumber, "left_stick_up", "left_stick_down");
        gamepad.left_stick_x = axis(gamepadNumber, "left_stick_left", "left_stick_right");
        gamepad.right_stick_y = axis(gamepadNumber, "right_stick_up", "right_stick_down");
        gamepad.right_stick_x = axis(gamepadNumber, "right_stick_left", "right_stick_right");

        gamepad.dpad_up = isPressed(gamepadNumber, "dpad_up");
        gamepad.dpad_down = isPressed(gamepadNumber, "dpad_down");
        gamepad.dpad_left = isPressed(gamepadNumber, "dpad_left");
        gamepad.dpad_right = isPressed(gamepadNumber, "dpad_right");

        gamepad.a = isPressed(gamepadNumber, "a");
        gamepad.b = isPressed(gamepadNumber, "b");
        gamepad.x = isPressed(gamepadNumber, "x");
        gamepad.y = isPressed(gamepadNumber, "y");
        gamepad.left_bumper = isPressed(gamepadNumber, "left_bumper");
        gamepad.right_bumper = isPressed(gamepadNumber, "right_bumper");
        gamepad.left_trigger = isPressed(gamepadNumber, "left_trigger") ? 1.0 : 0.0;
        gamepad.right_trigger = isPressed(gamepadNumber, "right_trigger") ? 1.0 : 0.0;
    }

    private double axis(int gamepadNumber, String negativeControl, String positiveControl) {
        double value = 0.0;

        if (isPressed(gamepadNumber, negativeControl)) value -= 1.0;
        if (isPressed(gamepadNumber, positiveControl)) value += 1.0;

        return value;
    }

    private boolean isPressed(int gamepadNumber, String control) {
        return pressedControls.contains(gamepadNumber + ":" + control);
    }
}
