"use client"

import * as React from "react"
import {
  Send,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Plus,
  FileText,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { AgentType } from "./agent-card"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Citation {
  id: string
  title: string
  excerpt: string
  source: string
  url?: string
}

export interface SuggestedTask {
  id: string
  label: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  suggestedTasks?: SuggestedTask[]
  createdAt: Date
  streaming?: boolean
}

export interface ChatInterfaceProps {
  agentType: AgentType
  agentName: string
  agentColor: string
  conversationId?: string
  onNewTask?: (task: string) => void
}

// ─── Simple Markdown Renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n")
  const nodes: React.ReactNode[] = []
  let listBuffer: string[] = []
  let key = 0

  const flushList = () => {
    if (listBuffer.length > 0) {
      nodes.push(
        <ul key={key++} className="my-2 ml-4 space-y-1 list-disc">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-slate-300 text-sm">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
      listBuffer = []
    }
  }

  for (const line of lines) {
    if (line.match(/^[-*]\s+/)) {
      listBuffer.push(line.replace(/^[-*]\s+/, ""))
    } else {
      flushList()
      if (line.startsWith("### ")) {
        nodes.push(
          <h3 key={key++} className="mt-3 mb-1 text-sm font-semibold text-slate-100">
            {renderInline(line.slice(4))}
          </h3>
        )
      } else if (line.startsWith("## ")) {
        nodes.push(
          <h2 key={key++} className="mt-4 mb-1.5 text-base font-semibold text-slate-100">
            {renderInline(line.slice(3))}
          </h2>
        )
      } else if (line.startsWith("```")) {
        // skip — handled separately
      } else if (line.trim() === "") {
        nodes.push(<br key={key++} />)
      } else {
        nodes.push(
          <p key={key++} className="text-sm leading-relaxed text-slate-300">
            {renderInline(line)}
          </p>
        )
      }
    }
  }
  flushList()
  return nodes
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-slate-100">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-indigo-300">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  agentColor,
  onAddTask,
}: {
  message: Message
  agentColor: string
  onAddTask?: (task: string) => void
}) {
  const [citationsOpen, setCitationsOpen] = React.useState(false)
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium mt-0.5",
          isUser
            ? "bg-slate-700 text-slate-300"
            : cn("text-white", agentColor.replace("text-", "bg-") + "/20")
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-slate-300" />}
      </div>

      <div className={cn("flex max-w-[80%] flex-col gap-2", isUser && "items-end")}>
        {/* Bubble */}
        <div
          className={cn(
            "rounded-lg px-4 py-3",
            isUser
              ? "bg-slate-700 text-slate-200"
              : cn("bg-slate-900 border border-slate-800", agentColor.replace("text-", "border-l-2 border-l-") + "/40")
          )}
        >
          {message.streaming ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
              </div>
              <span className="text-xs text-slate-500">Thinking...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {renderMarkdown(message.content)}
              {message.streaming === false && (
                <span className="inline-block h-4 w-0.5 animate-pulse bg-indigo-400 align-middle ml-0.5" />
              )}
            </div>
          )}
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="w-full">
            <button
              onClick={() => setCitationsOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              <FileText className="h-3 w-3" />
              {message.citations.length} source{message.citations.length > 1 ? "s" : ""}
              {citationsOpen ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {citationsOpen && (
              <div className="mt-2 space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
                {message.citations.map((citation) => (
                  <div key={citation.id} className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-300 truncate">
                          {citation.title}
                        </span>
                        {citation.url && (
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0"
                          >
                            <ExternalLink className="h-3 w-3 text-slate-600 hover:text-slate-400" />
                          </a>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 line-clamp-2">
                        {citation.excerpt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suggested tasks */}
        {message.suggestedTasks && message.suggestedTasks.length > 0 && onAddTask && (
          <div className="flex flex-wrap gap-2">
            {message.suggestedTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onAddTask(task.label)}
                className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs text-slate-300 transition-colors hover:border-indigo-600/50 hover:bg-indigo-600/10 hover:text-indigo-300"
              >
                <Plus className="h-3 w-3" />
                {task.label}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-slate-700">
          {message.createdAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}

// ─── Chat Interface ───────────────────────────────────────────────────────────

export function ChatInterface({
  agentType,
  agentName,
  agentColor,
  conversationId,
  onNewTask,
}: ChatInterfaceProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState("")
  const [isStreaming, setIsStreaming] = React.useState(false)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = React.useCallback(async () => {
    const content = input.trim()
    if (!content || isStreaming) return

    setInput("")

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    }

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date(),
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType,
          conversationId,
          message: content,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error("Failed to get response")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })

        // Parse SSE lines
        const lines = chunk.split("\n")
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") break
            try {
              const parsed = JSON.parse(data)
              if (parsed.delta) accumulated += parsed.delta
            } catch {
              // Non-JSON data, append directly
              accumulated += data
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: accumulated, streaming: true }
              : m
          )
        )
      }

      // Finalize
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: accumulated || "I've processed your request.",
                streaming: false,
              }
            : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: "Sorry, I encountered an error. Please try again.",
                streaming: false,
              }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
      textareaRef.current?.focus()
    }
  }, [input, isStreaming, agentType, conversationId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl",
                agentColor.replace("text-", "bg-") + "/15"
              )}
            >
              <Bot className={cn("h-7 w-7", agentColor)} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">{agentName}</h3>
              <p className="mt-1 text-sm text-slate-500">
                Start a conversation. I&apos;m here to help.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs text-slate-600">
              <p>Shift + Enter for new line</p>
              <p>Enter to send</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                agentColor={agentColor}
                onAddTask={onNewTask}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <Separator className="bg-slate-800" />

      {/* Input */}
      <div className="p-4">
        <div className="relative flex items-end gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3 focus-within:border-indigo-600/50 transition-colors">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}...`}
            className="min-h-[44px] max-h-40 flex-1 resize-none border-0 bg-transparent p-0 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:ring-0"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            size="icon"
            variant={input.trim() ? "ai" : "ghost"}
            className="h-8 w-8 shrink-0"
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-700">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
