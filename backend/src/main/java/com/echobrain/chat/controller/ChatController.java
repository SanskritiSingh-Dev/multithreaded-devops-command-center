package com.echobrain.chat.controller;

import com.echobrain.chat.model.ChatMessage;
import com.echobrain.chat.service.StressTestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Controller responsible for handling WebSocket message routing, rate limiting, and leaderboard tracking.
 * Implements a Velocity Tracker to defend against spam and DDoS floods during stress tests.
 */
@Controller
public class ChatController {

    @Autowired
    private StressTestService stressTestService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private final Map<String, Integer> leaderboard = new ConcurrentHashMap<>();
    private final Set<String> bannedUsers = ConcurrentHashMap.newKeySet();
    private final Map<String, List<Long>> userMessageTimestamps = new ConcurrentHashMap<>();

    /**
     * Flags a user as permanently banned and broadcasts a system alert.
     * @param username The username to ban.
     */
    public void banUser(String username) {
        bannedUsers.add(username);
        messagingTemplate.convertAndSend("/topic/security", bannedUsers);
        
        ChatMessage banAlert = new ChatMessage();
        banAlert.setType(ChatMessage.MessageType.CHAT);
        banAlert.setSender("SYSTEM");
        banAlert.setContent("🚨 [SECURITY] " + username + " was permanently banned for spamming.");
        banAlert.setChannel("stress-test-logs");
        messagingTemplate.convertAndSend("/topic/stress-test-logs", banAlert);
    }
    
    /**
     * Primary WebSocket message handler. Applies Rate Limiting, Profanity Filtering, and Leaderboard tracking.
     * @param channel The dynamic topic channel.
     * @param chatMessage The incoming message payload.
     */
    @MessageMapping("/chat/{channel}/sendMessage")
    public void sendMessage(@DestinationVariable String channel, @Payload ChatMessage chatMessage) {
        chatMessage.setChannel(channel);
        String sender = chatMessage.getSender();

        if (bannedUsers.contains(sender)) {
            return;
        }

        if (!"SYSTEM".equals(sender)) {
            long now = System.currentTimeMillis();
            userMessageTimestamps.putIfAbsent(sender, new ArrayList<>());
            List<Long> timestamps = userMessageTimestamps.get(sender);
            
            synchronized (timestamps) {
                timestamps.removeIf(t -> now - t > 1000);
                timestamps.add(now);
                
                if (timestamps.size() > 5) {
                    banUser(sender);
                    return;
                }
            }
        }
        
        String content = chatMessage.getContent();
        if (content != null) {
            String[] forbiddenWords = {"spam", "hack", "badword", "idiot", "fuck", "shit", "bitch", "asshole", "crap", "damn"};
            for (String word : forbiddenWords) {
                if (content.toLowerCase().contains(word)) {
                    content = content.replaceAll("(?i)" + word, "***");
                }
            }
            chatMessage.setContent(content);
        }

        if (chatMessage.getType() == ChatMessage.MessageType.CHAT && !"SYSTEM".equals(chatMessage.getSender())) {
            leaderboard.merge(chatMessage.getSender(), 1, Integer::sum);
            broadcastLeaderboard();
        }

        messagingTemplate.convertAndSend("/topic/" + channel, chatMessage);
    }

    /**
     * Sorts the leaderboard map and broadcasts the top 5 active users to the frontend.
     */
    private void broadcastLeaderboard() {
        List<Map.Entry<String, Integer>> topUsers = leaderboard.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(5)
                .collect(Collectors.toList());

        List<LeaderboardEntry> sortedList = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : topUsers) {
            sortedList.add(new LeaderboardEntry(entry.getKey(), entry.getValue()));
        }
        
        messagingTemplate.convertAndSend("/topic/leaderboard", sortedList);
    }

    // Inner class for JSON serialization
    public static class LeaderboardEntry {
        public String username;
        public int messageCount;

        public LeaderboardEntry(String username, int messageCount) {
            this.username = username;
            this.messageCount = messageCount;
        }
    }

    @MessageMapping("/chat/{channel}/typing")
    @SendTo("/topic/{channel}")
    public ChatMessage typing(@DestinationVariable String channel, @Payload ChatMessage chatMessage) {
        chatMessage.setChannel(channel);
        return chatMessage;
    }

    @MessageMapping("/chat/{channel}/addUser")
    @SendTo("/topic/{channel}")
    public ChatMessage addUser(@DestinationVariable String channel, @Payload ChatMessage chatMessage, 
                               SimpMessageHeaderAccessor headerAccessor) {
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        chatMessage.setChannel(channel);
        return chatMessage;
    }

    @MessageMapping("/chat.triggerStressTest")
    public void triggerStressTest() {
        stressTestService.startStressTest();
    }

}
