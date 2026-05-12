package com.echobrain.chat.service;

import com.echobrain.chat.model.ChatMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class StressTestService {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private final String[] botNames = {"Bot_Alpha", "Bot_Beta", "Bot_Gamma", "Bot_Delta", "Bot_Omega", "Bot_Zeta"};
    private final String[] messages = {
            "Testing concurrency...",
            "Message received and processed.",
            "Spring Boot handles this perfectly.",
            "Multithreading is awesome!",
            "Thread load increasing...",
            "System remains stable."
    };

    public void startStressTest() {
        // Broadcast that stress test is starting
        ChatMessage startMsg = new ChatMessage();
        startMsg.setType(ChatMessage.MessageType.CHAT);
        startMsg.setSender("SYSTEM");
        startMsg.setContent("🚀 STRESS TEST INITIATED. Spawning 45 normal bots and 5 Chaos Bots...");
        startMsg.setChannel("stress-test-logs");
        messagingTemplate.convertAndSend("/topic/stress-test-logs", startMsg);

        // Create an ExecutorService with 50 threads
        ExecutorService executor = Executors.newFixedThreadPool(50);
        Random random = new Random();

        // Submit 50 tasks (virtual bots) to the executor
        for (int i = 0; i < 50; i++) {
            final int botId = i;
            // First 5 bots are "Chaos Bots" designed to break the system
            final boolean isChaosBot = (i < 5); 
            
            executor.submit(() -> {
                try {
                    // Random delay to simulate jitter
                    Thread.sleep(random.nextInt(2000));
                    
                    String botName = isChaosBot ? "CHAOS_BOT_" + botId : botNames[random.nextInt(botNames.length)] + "_" + botId;

                    if (isChaosBot) {
                        // Spam 6 messages instantly to simulate rate limit trigger
                        for(int j=0; j<6; j++) {
                            ChatMessage msg = new ChatMessage();
                            msg.setType(ChatMessage.MessageType.CHAT);
                            msg.setSender(botName);
                            msg.setContent("SPAM SPAM SPAM!!! I AM A HACKER");
                            msg.setChannel("stress-test-logs");
                            messagingTemplate.convertAndSend("/topic/stress-test-logs", msg);
                        }
                        // Simulate ban response from backend
                        ChatMessage banAlert = new ChatMessage();
                        banAlert.setType(ChatMessage.MessageType.CHAT);
                        banAlert.setSender("SYSTEM");
                        banAlert.setContent("🚨 [SECURITY] " + botName + " was permanently banned for spamming.");
                        banAlert.setChannel("stress-test-logs");
                        messagingTemplate.convertAndSend("/topic/stress-test-logs", banAlert);
                    } else {
                        // Normal bot sends 5 messages with normal delay
                        for (int j = 0; j < 5; j++) {
                            ChatMessage msg = new ChatMessage();
                            msg.setType(ChatMessage.MessageType.CHAT);
                            msg.setSender(botName);
                            msg.setContent(messages[random.nextInt(messages.length)]);
                            msg.setChannel("stress-test-logs");
                            
                            messagingTemplate.convertAndSend("/topic/stress-test-logs", msg);
                            
                            // Wait a fraction of a second before next message
                            Thread.sleep(200 + random.nextInt(500));
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            });
        }
        
        executor.shutdown();
    }
}
