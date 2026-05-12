package com.echobrain.chat.service;

import com.echobrain.chat.model.ServerMetrics;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.lang.management.ManagementFactory;

@Service
public class MetricsService {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedRate = 1000)
    public void broadcastMetrics() {
        int threadCount = ManagementFactory.getThreadMXBean().getThreadCount();
        long freeMemory = Runtime.getRuntime().freeMemory() / (1024 * 1024);
        long totalMemory = Runtime.getRuntime().totalMemory() / (1024 * 1024);

        ServerMetrics metrics = new ServerMetrics(threadCount, freeMemory, totalMemory);
        messagingTemplate.convertAndSend("/topic/metrics", metrics);
    }
}
