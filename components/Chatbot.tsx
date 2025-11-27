"use client";
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_SUGGESTIONS = [
  "What are your gym hours?",
  "How much is the monthly membership?",
  "What classes do you offer?",
  "Who are the available coaches?",
  "What's the walk-in rate?",
  "Tell me about student discounts",
  "What amenities do you have?",
  "What are the gym rules?",
];

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your GymSchedPro assistant. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Hide suggestions after first user message
    if (messages.some(msg => msg.role === 'user')) {
      setShowSuggestions(false);
    }
  }, [messages]);

  const handleSend = async (messageContent?: string) => {
    const content = messageContent || input.trim();
    if (!content || isLoading) return;

    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full p-4 shadow-2xl transition-all duration-300 hover:scale-110 z-50"
        >
          <MessageCircle className="size-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <MessageCircle className="size-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Gym Assistant</h3>
                <p className="text-xs text-white/80">Online</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-100 border border-gray-700'
                    }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-2">
                  <Loader2 className="size-5 animate-spin text-orange-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions or Input */}
          <div className="p-4 border-t border-gray-700">
            {showSuggestions ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-2">Quick questions:</p>
                <div className="grid grid-cols-2 gap-2">
                  {CHAT_SUGGESTIONS.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={isLoading}
                      className="text-left text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-2 border border-gray-700 hover:border-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="w-full text-xs text-orange-400 hover:text-orange-300 mt-2"
                >
                  Type your own question
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 bg-gray-800 text-white rounded-full px-4 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500"
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={isLoading || !input.trim()}
                    className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-full p-2 transition-colors"
                  >
                    <Send className="size-5" />
                  </button>
                </div>
                <button
                  onClick={() => setShowSuggestions(true)}
                  className="w-full text-xs text-orange-400 hover:text-orange-300"
                >
                  Show suggestions
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}