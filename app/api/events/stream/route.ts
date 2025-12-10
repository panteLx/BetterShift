import { NextRequest } from "next/server";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";

// Disable default body parsing
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const calendarId = searchParams.get("calendarId");

  if (!calendarId) {
    return new Response(JSON.stringify({ error: "Calendar ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectMessage = `data: ${JSON.stringify({
        type: "connected",
        calendarId,
      })}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      // Event handler for calendar changes
      const handleCalendarChange = (data: unknown) => {
        const event = data as CalendarChangeEvent;
        // Only send events for the subscribed calendar
        if (event.calendarId === calendarId) {
          const message = `data: ${JSON.stringify(event)}\n\n`;
          try {
            controller.enqueue(encoder.encode(message));
          } catch (error) {
            console.error("Error sending SSE message:", error);
            // Client likely disconnected, will be cleaned up below
          }
        }
      };

      // Subscribe to calendar changes
      eventEmitter.on("calendar-change", handleCalendarChange);

      // Send keepalive ping every 30 seconds to prevent timeout
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // Client disconnected
          clearInterval(keepAliveInterval);
        }
      }, 30000);

      // Clean up on disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(keepAliveInterval);
        eventEmitter.off("calendar-change", handleCalendarChange);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
