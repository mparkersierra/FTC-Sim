package com.mparkersierra.ftcsim.runner.opmode;

public class OpModeInfo {
    public final String id;
    public final String name;
    public final String group;
    public final String type;
    public final Class<?> clazz;

    public OpModeInfo(String id, String name, String group, String type, Class<?> clazz) {
        this.id = id;
        this.name = name;
        this.group = group;
        this.type = type;
        this.clazz = clazz;
    }
}
