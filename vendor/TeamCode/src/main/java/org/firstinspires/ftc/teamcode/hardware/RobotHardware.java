package org.firstinspires.ftc.teamcode.hardware;

import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class RobotHardware {

    private HardwareMap hw;

    // Motors
    public DcMotor lf, rf, lb, rb;

    public DcMotor linearLift;


    public RobotHardware(HardwareMap hw) {
        this.hw = hw;

        lf = hw.get(DcMotor.class, "leftFront");
        rf = hw.get(DcMotor.class, "rightFront");
        lb = hw.get(DcMotor.class, "leftBack");
        rb = hw.get(DcMotor.class, "rightBack");

        lf.setDirection(DcMotor.Direction.REVERSE);
        lb.setDirection(DcMotor.Direction.REVERSE);

        
    }
}