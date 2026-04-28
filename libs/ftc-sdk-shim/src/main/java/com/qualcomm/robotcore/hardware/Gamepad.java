package com.qualcomm.robotcore.hardware;

public class Gamepad {
    public volatile boolean dpad_up = false;
    public volatile boolean dpad_down = false;
    public volatile boolean dpad_left = false;
    public volatile boolean dpad_right = false;

    public volatile boolean a = false;
    public volatile boolean b = false;
    public volatile boolean x = false;
    public volatile boolean y = false;
    public volatile boolean left_bumper = false;
    public volatile boolean right_bumper = false;
    public volatile double left_trigger = 0.0;
    public volatile double right_trigger = 0.0;

    public volatile double left_stick_x = 0.0;
    public volatile double left_stick_y = 0.0;
    public volatile double right_stick_x = 0.0;
    public volatile double right_stick_y = 0.0;

    public void resetButtons() {
        dpad_up = false;
        dpad_down = false;
        dpad_left = false;
        dpad_right = false;

        a = false;
        b = false;
        x = false;
        y = false;
        left_bumper = false;
        right_bumper = false;
        left_trigger = 0.0;
        right_trigger = 0.0;

        left_stick_x = 0.0;
        left_stick_y = 0.0;
        right_stick_x = 0.0;
        right_stick_y = 0.0;
    }
}
