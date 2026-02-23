import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '@marionette/shared';

interface AgentMessengerState {
  // Messages by agent ID
  messagesByAgent: Record<string, Message[]>;

  // Unread counts by agent ID
  unreadCounts: Record<string, number>;

  // Current active tab
  activeTab: 'overview' | 'messenger' | 'inspect';

  // Typing indicators by agent ID
  typingAgents: Set<string>;

  // Actions
  addMessage: (agentId: string, message: Message) => void;
  setMessages: (agentId: string, messages: Message[]) => void;
  markAsRead: (agentId: string) => void;
  setActiveTab: (tab: 'overview' | 'messenger' | 'inspect') => void;
  setTyping: (agentId: string, isTyping: boolean) => void;
  clearMessages: (agentId: string) => void;
  incrementUnread: (agentId: string) => void;
}

export const useAgentMessengerStore = create<AgentMessengerState>()(
  persist(
    (set, get) => ({
      messagesByAgent: {},
      unreadCounts: {},
      activeTab: 'overview',
      typingAgents: new Set<string>(),

      addMessage: (agentId, message) => {
        set((state) => {
          const existingMessages = state.messagesByAgent[agentId] || [];

          // Check if message already exists (prevent duplicates)
          if (existingMessages.some(m => m.id === message.id)) {
            return state;
          }

          return {
            messagesByAgent: {
              ...state.messagesByAgent,
              [agentId]: [...existingMessages, message],
            },
          };
        });

        // Increment unread count if it's a message from the agent
        if (message.direction === 'from_agent' && get().activeTab !== 'messenger') {
          get().incrementUnread(agentId);
        }
      },

      setMessages: (agentId, messages) => {
        set((state) => ({
          messagesByAgent: {
            ...state.messagesByAgent,
            [agentId]: messages,
          },
        }));
      },

      markAsRead: (agentId) => {
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [agentId]: 0,
          },
        }));
      },

      setActiveTab: (tab) => {
        set({ activeTab: tab });
      },

      setTyping: (agentId, isTyping) => {
        set((state) => {
          const newTyping = new Set(state.typingAgents);
          if (isTyping) {
            newTyping.add(agentId);
          } else {
            newTyping.delete(agentId);
          }
          return { typingAgents: newTyping };
        });
      },

      clearMessages: (agentId) => {
        set((state) => ({
          messagesByAgent: {
            ...state.messagesByAgent,
            [agentId]: [],
          },
          unreadCounts: {
            ...state.unreadCounts,
            [agentId]: 0,
          },
        }));
      },

      incrementUnread: (agentId) => {
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [agentId]: (state.unreadCounts[agentId] || 0) + 1,
          },
        }));
      },
    }),
    {
      name: 'agent-messenger-storage',
      partialize: (state) => ({
        messagesByAgent: state.messagesByAgent,
        unreadCounts: state.unreadCounts,
      }),
    }
  )
);
