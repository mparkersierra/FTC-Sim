package com.mparkersierra.ftcsim.runner;

import com.qualcomm.robotcore.hardware.Gamepad;

public class BrowserGamepadController {
    private final Gamepad gamepad;
    private boolean wPressed;
    private boolean sPressed;
    private boolean aPressed;
    private boolean dPressed;
    private boolean arrowUpPressed;
    private boolean arrowDownPressed;
    private boolean arrowLeftPressed;
    private boolean arrowRightPressed;

    public BrowserGamepadController(Gamepad gamepad) {
        this.gamepad = gamepad;
    }

    public synchronized void handleInput(String key, boolean pressed) {
        switch (key.toLowerCase()) {
            case "w":
                wPressed = pressed;
                break;
            case "s":
                sPressed = pressed;
                break;
            case "a":
                aPressed = pressed;
                break;
            case "d":
                dPressed = pressed;
                break;
            case " ":
                gamepad.a = pressed;
                break;
            case "arrowup":
                arrowUpPressed = pressed;
                break;

            case "arrowdown":
                arrowDownPressed = pressed;
                break;

            case "arrowleft":
                arrowLeftPressed = pressed;
                break;

            case "arrowright":
                arrowRightPressed = pressed;
                break;
            default:
                return;
        }

        gamepad.left_stick_y = axisValue(wPressed, sPressed, -1.0, 1.0);
        gamepad.left_stick_x = axisValue(aPressed, dPressed, -1.0, 1.0);
        gamepad.right_stick_y = axisValue(arrowUpPressed, arrowDownPressed, -1.0, 1.0);
        gamepad.right_stick_x = axisValue(arrowLeftPressed, arrowRightPressed, -1.0, 1.0);
    }

    private double axisValue(boolean negativePressed, boolean positivePressed, double negativeValue, double positiveValue) {
        if (negativePressed == positivePressed) {
            return 0.0;
        }

        return negativePressed ? negativeValue : positiveValue;
    }
}
