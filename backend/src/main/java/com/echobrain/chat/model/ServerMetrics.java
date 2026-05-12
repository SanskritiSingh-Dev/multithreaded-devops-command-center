package com.echobrain.chat.model;

public class ServerMetrics {
    private int activeThreads;
    private long freeMemoryMb;
    private long totalMemoryMb;

    public ServerMetrics(int activeThreads, long freeMemoryMb, long totalMemoryMb) {
        this.activeThreads = activeThreads;
        this.freeMemoryMb = freeMemoryMb;
        this.totalMemoryMb = totalMemoryMb;
    }

    public int getActiveThreads() { return activeThreads; }
    public long getFreeMemoryMb() { return freeMemoryMb; }
    public long getTotalMemoryMb() { return totalMemoryMb; }
}
