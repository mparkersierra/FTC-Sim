package com.mparkersierra.ftcsim.runner.input;

import com.mparkersierra.ftcsim.runner.opmode.OpModeManager;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;

public class BrowserGamepadController {
    private final OpModeManager opModeManager;

    public BrowserGamepadController(OpModeManager opModeManager) {
        this.opModeManager = opModeManager;
    }

    public void handleInput(String key, boolean pressed) {
        LinearOpMode opMode = opModeManager.getCurrentOpMode();
        if (opMode == null) return;
        
        switch (key.toLowerCase()) {
            case "w":
                opMode.gamepad1.left_stick_y = pressed ? -1.0 : 0.0;
                break;
            case "s":
                opMode.gamepad1.left_stick_y = pressed ? 1.0 : 0.0;
                break;
            case "a":
                opMode.gamepad1.left_stick_x = pressed ? -1.0 : 0.0;
                break;
            case "d":
                opMode.gamepad1.left_stick_x = pressed ? 1.0 : 0.0;
                break;
            case "arrowup":
                opMode.gamepad1.right_stick_y = pressed ? -1.0 : 0.0;
                break;

            case "arrowdown":
                opMode.gamepad1.right_stick_y = pressed ? 1.0 : 0.0;
                break;

            case "arrowleft":
                opMode.gamepad1.right_stick_x = pressed ? -1.0 : 0.0;
                break;

            case "arrowright":
                opMode.gamepad1.right_stick_x = pressed ? 1.0 : 0.0;
                break;
            default:
                return;
        }
    }
}
