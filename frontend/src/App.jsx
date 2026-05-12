import { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';
import { Send, LogOut, Activity, Cpu, Database, Zap, Hash, ShieldAlert, Trophy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './index.css';

const CHANNELS = [
  { id: 'general-chat', name: 'General Chat', icon: <Hash size={18} /> },
  { id: 'stress-test-logs', name: 'Stress Test Logs', icon: <ShieldAlert size={18} /> }
];

function App() {
  const [username, setUsername] = useState('');
  const [connected, setConnected] = useState(false);
  
  // State for channels
  const [activeChannel, setActiveChannel] = useState('general-chat');
  const [messages, setMessages] = useState({
    'general-chat': [],
    'stress-test-logs': []
  });
  
  const [messageInput, setMessageInput] = useState('');
  const [metrics, setMetrics] = useState({ activeThreads: 0, freeMemoryMb: 0, totalMemoryMb: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [bannedUsers, setBannedUsers] = useState([]);
  
  const [typingUsers, setTypingUsers] = useState({
    'general-chat': {},
    'stress-test-logs': {}
  });
  
  const clientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const myTypingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChannel, typingUsers]);

  useEffect(() => {
    return () => {
      if (clientRef.current && clientRef.current.active) {
        clientRef.current.deactivate();
      }
    };
  }, []);

  const connect = (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    const socket = new SockJS('http://localhost:8080/ws');
    const client = new Client({
      webSocketFactory: () => socket,
      debug: () => {},
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = () => {
      setConnected(true);
      
      // Subscribe to all channels
      CHANNELS.forEach(channel => {
        client.subscribe(`/topic/${channel.id}`, (message) => {
          const receivedMsg = JSON.parse(message.body);
          const ch = receivedMsg.channel || channel.id; 
          
          if (receivedMsg.type === 'TYPING') {
            if (receivedMsg.sender !== username) {
              setTypingUsers(prev => {
                const newMap = { ...prev };
                if (!newMap[ch]) newMap[ch] = {};
                if (newMap[ch][receivedMsg.sender]) clearTimeout(newMap[ch][receivedMsg.sender]);
                
                newMap[ch][receivedMsg.sender] = setTimeout(() => {
                  setTypingUsers(current => {
                    const temp = { ...current };
                    if(temp[ch]) delete temp[ch][receivedMsg.sender];
                    return temp;
                  });
                }, 3000);
                return newMap;
              });
            }
          } else {
            // Real message, clear typing
            setTypingUsers(prev => {
              const newMap = { ...prev };
              if (newMap[ch] && newMap[ch][receivedMsg.sender]) {
                clearTimeout(newMap[ch][receivedMsg.sender]);
                delete newMap[ch][receivedMsg.sender];
              }
              return newMap;
            });
            
            setMessages(prev => ({
              ...prev,
              [ch]: [...(prev[ch] || []), receivedMsg]
            }));
          }
        });
      });

      // Subscribe to metrics
      client.subscribe('/topic/metrics', (message) => {
        setMetrics(JSON.parse(message.body));
      });

      // Subscribe to leaderboard
      client.subscribe('/topic/leaderboard', (message) => {
        setLeaderboard(JSON.parse(message.body));
      });

      // Subscribe to security bans
      client.subscribe('/topic/security', (message) => {
        setBannedUsers(JSON.parse(message.body));
      });

      // Send JOIN to general-chat
      client.publish({
        destination: '/app/chat/general-chat/addUser',
        body: JSON.stringify({ sender: username, type: 'JOIN' }),
      });
    };

    client.activate();
    clientRef.current = client;
  };

  const disconnect = () => {
    if (clientRef.current && clientRef.current.active) {
      clientRef.current.deactivate();
    }
    setConnected(false);
    setMessages({ 'general-chat': [], 'stress-test-logs': [] });
    setUsername('');
    setTypingUsers({ 'general-chat': {}, 'stress-test-logs': {} });
    setLeaderboard([]);
    setBannedUsers([]);
  };

  const handleTyping = (e) => {
    setMessageInput(e.target.value);
    
    if (!myTypingTimeoutRef.current && clientRef.current && clientRef.current.active) {
      clientRef.current.publish({
        destination: `/app/chat/${activeChannel}/typing`,
        body: JSON.stringify({ sender: username, type: 'TYPING', channel: activeChannel }),
      });
      
      myTypingTimeoutRef.current = setTimeout(() => {
        myTypingTimeoutRef.current = null;
      }, 2000);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && clientRef.current && clientRef.current.active) {
      const chatMessage = {
        sender: username,
        content: messageInput,
        type: 'CHAT',
        channel: activeChannel
      };
      clientRef.current.publish({
        destination: `/app/chat/${activeChannel}/sendMessage`,
        body: JSON.stringify(chatMessage),
      });
      setMessageInput('');
    }
  };

  const triggerStressTest = () => {
    if (clientRef.current && clientRef.current.active) {
      clientRef.current.publish({
        destination: '/app/chat.triggerStressTest',
        body: '',
      });
    }
  };

  if (!connected) {
    return (
      <div className="app-container">
        <div className="login-screen glass-card">
          <h1>Command Center</h1>
          <p>Join the Engineering Workspace</p>
          <form onSubmit={connect}>
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary" disabled={!username.trim()}>
              Enter Workspace
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeTypers = Object.keys(typingUsers[activeChannel] || {});
  let typingStatusText = '';
  if (activeTypers.length === 1) {
    typingStatusText = `${activeTypers[0]} is typing...`;
  } else if (activeTypers.length > 1) {
    typingStatusText = `${activeTypers.length} people are typing...`;
  }

  const activeMessages = messages[activeChannel] || [];

  return (
    <div className="app-container layout-row">
      
      {/* 1. Left Sidebar: Channels */}
      <div className="channels-sidebar glass-card">
        <h3>Workspace</h3>
        <div className="channel-list">
          {CHANNELS.map(ch => (
            <div 
              key={ch.id} 
              className={`channel-item ${activeChannel === ch.id ? 'active' : ''}`}
              onClick={() => setActiveChannel(ch.id)}
            >
              {ch.icon}
              <span>{ch.name}</span>
            </div>
          ))}
        </div>
        
        <div className="user-profile-bottom">
          <div className="user-badge">
            <div className="status-dot"></div>
            <span>{username}</span>
          </div>
          <LogOut 
            size={18} 
            style={{ cursor: 'pointer', color: '#ef4444' }} 
            onClick={disconnect}
            title="Disconnect"
          />
        </div>
      </div>

      {/* 2. Center: Chat Area */}
      <div className="chat-screen glass-card">
        <header className="chat-header">
          <h2>#{CHANNELS.find(c => c.id === activeChannel)?.name}</h2>
          <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic'}}>
            {activeChannel === 'stress-test-logs' ? 'System logs stream here.' : ''}
          </span>
        </header>

        <div className="chat-messages">
          {activeMessages.length === 0 && (
            <div style={{textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px'}}>
              Welcome to the beginning of the #{CHANNELS.find(c => c.id === activeChannel)?.name} channel.
            </div>
          )}
          
          {activeMessages.map((msg, index) => {
            if (msg.type === 'JOIN') {
              return <div key={index} className="message-event">{msg.sender} joined the channel</div>;
            } else if (msg.type === 'LEAVE') {
              return <div key={index} className="message-event">{msg.sender} left the channel</div>;
            } else {
              const isSelf = msg.sender === username;
              const isSystem = msg.sender === 'SYSTEM';
              
              if (isSystem) {
                return (
                  <div key={index} className="message-event" style={{ color: '#ef4444', fontWeight: 'bold', borderColor: '#ef4444' }}>
                    {msg.content}
                  </div>
                );
              }

              return (
                <div key={index} className={`message-wrapper ${isSelf ? 'self' : 'other'}`}>
                  {!isSelf && (
                    <div className="message-sender" style={{ color: 'var(--text-secondary)'}}>
                      {msg.sender}
                    </div>
                  )}
                  <div className="message-bubble">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              );
            }
          })}
          
          {typingStatusText && (
            <div className="message-event" style={{ alignSelf: 'flex-start', fontStyle: 'italic', opacity: 0.7, border: 'none', background: 'transparent' }}>
              {typingStatusText}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-container" onSubmit={sendMessage}>
          <input
            type="text"
            placeholder={`Message #${CHANNELS.find(c => c.id === activeChannel)?.name}`}
            value={messageInput}
            onChange={handleTyping}
            autoFocus
          />
          <button type="submit" className="btn-send" disabled={!messageInput.trim()}>
            <Send size={20} />
          </button>
        </form>
      </div>

      {/* 3. Right Sidebar: Diagnostics & Leaderboard */}
      <div className="diagnostics-panel glass-card">
        <h3><Activity size={18}/> Server Health</h3>
        <div className="metrics-grid" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <div className="metric-box" style={{ flex: 1, padding: '10px' }}>
            <div className="metric-header"><Cpu size={14}/> Threads</div>
            <div className="metric-value" style={{ fontSize: '1.2rem'}}>{metrics.activeThreads}</div>
          </div>
          <div className="metric-box" style={{ flex: 1, padding: '10px' }}>
            <div className="metric-header"><Database size={14}/> Mem</div>
            <div className="metric-value" style={{ fontSize: '1.2rem'}}>{metrics.freeMemoryMb}M</div>
          </div>
        </div>
        
        <button className="btn-danger" onClick={triggerStressTest} style={{ marginBottom: '16px' }}>
          <Zap size={16} /> Run Stress Test
        </button>

        <h3 style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
          <Trophy size={18} color="#d4af37"/> Top Active Users
        </h3>
        
        <div className="leaderboard-container">
          {leaderboard.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>
              No messages sent yet.
            </div>
          ) : (
            leaderboard.map((user, index) => (
              <div key={user.username} className="leaderboard-item">
                <div className="rank">#{index + 1}</div>
                <div className="name">{user.username}</div>
                <div className="score">{user.messageCount} msg</div>
              </div>
            ))
          )}
        </div>

        {bannedUsers.length > 0 && (
          <div style={{ marginTop: 'auto' }}>
            <h3 style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', color: '#ef4444' }}>
              <ShieldAlert size={18} /> Blocked Threats
            </h3>
            <div className="banned-container">
              {bannedUsers.map((user) => (
                <div key={user} className="threat-item">
                  <span className="threat-name">{user}</span>
                  <span className="threat-tag">BANNED</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}

export default App;
