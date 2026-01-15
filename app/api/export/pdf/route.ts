import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { jsPDF } from "jspdf";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar } from "@/lib/auth/permissions";
import { rateLimit } from "@/lib/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request.headers);

    // Rate limiting: 10 PDF exports per 10 minutes
    const rateLimitResponse = rateLimit(request, user?.id, "export-pdf");
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // Format: YYYY-MM
    const year = searchParams.get("year"); // Format: YYYY
    const locale = searchParams.get("locale") || "en"; // Default to English

    const { calendarIds } = await request.json();

    if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
      return NextResponse.json(
        { error: "No calendar IDs provided" },
        { status: 400 }
      );
    }

    // Get all requested calendars
    const requestedCalendars = await db.query.calendars.findMany({
      where: inArray(calendars.id, calendarIds),
    });

    if (requestedCalendars.length === 0) {
      return NextResponse.json(
        { error: "No calendars found" },
        { status: 404 }
      );
    }

    // Filter calendars by permission - only include calendars user can view
    const accessibleCalendars = [];
    for (const calendar of requestedCalendars) {
      const hasAccess = await canViewCalendar(user?.id, calendar.id);
      if (hasAccess) {
        accessibleCalendars.push(calendar);
      }
    }

    if (accessibleCalendars.length === 0) {
      return NextResponse.json(
        { error: "Insufficient permissions for selected calendars" },
        { status: 403 }
      );
    }

    // Get all shifts for accessible calendars
    let allShifts = await db.query.shifts.findMany({
      where: inArray(
        shifts.calendarId,
        accessibleCalendars.map((c) => c.id)
      ),
      orderBy: (shifts, { asc }) => [asc(shifts.date)],
    });

    // Filter by month or year if provided
    if (month) {
      const [filterYear, filterMonth] = month.split("-").map(Number);
      allShifts = allShifts.filter((shift) => {
        const shiftDate = shift.date as Date;
        return (
          shiftDate.getFullYear() === filterYear &&
          shiftDate.getMonth() + 1 === filterMonth
        );
      });
    } else if (year) {
      const filterYear = parseInt(year);
      allShifts = allShifts.filter((shift) => {
        const shiftDate = shift.date as Date;
        return shiftDate.getFullYear() === filterYear;
      });
    }

    // Create calendar lookup map
    const calendarMap = new Map(
      accessibleCalendars.map((c) => [c.id, { name: c.name, color: c.color }])
    );

    // Determine if multi-calendar export
    const isMultiCalendar = accessibleCalendars.length > 1;

    // Sort all shifts by date (already sorted from DB, but ensure it)
    allShifts.sort((a, b) => {
      const dateA = (a.date as Date).getTime();
      const dateB = (b.date as Date).getTime();
      return dateA - dateB;
    });

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Helper function to add new page if needed
    const checkPageBreak = (neededSpace: number) => {
      if (yPosition + neededSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Helper function to parse hex color
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 };
    };

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(
      isMultiCalendar
        ? "BetterShift Multi-Calendar Export"
        : accessibleCalendars[0].name,
      pageWidth / 2,
      yPosition,
      { align: "center" }
    );
    yPosition += 10;

    // Calendar names (only for multi-calendar)
    if (isMultiCalendar) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const calendarNames = accessibleCalendars.map((c) => c.name).join(", ");
      const wrappedNames = doc.splitTextToSize(
        calendarNames,
        pageWidth - margin * 2
      );
      for (const line of wrappedNames) {
        doc.text(line, pageWidth / 2, yPosition, { align: "center" });
        yPosition += 5;
      }
    }

    // Date range
    if (month || year) {
      const dateRangeText = month ? `${month}` : `${year}`;
      doc.text(dateRangeText, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 5;
    }

    // Horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    if (allShifts.length === 0) {
      // Empty state
      yPosition += 20;
    } else {
      // Group shifts by month
      const shiftsByMonth = new Map<string, typeof allShifts>();
      for (const shift of allShifts) {
        const shiftDate = shift.date as Date;
        const monthKey = `${shiftDate.getFullYear()}-${String(
          shiftDate.getMonth() + 1
        ).padStart(2, "0")}`;
        if (!shiftsByMonth.has(monthKey)) {
          shiftsByMonth.set(monthKey, []);
        }
        shiftsByMonth.get(monthKey)!.push(shift);
      }

      // Sort months chronologically
      const sortedMonths = Array.from(shiftsByMonth.keys()).sort();

      for (const monthKey of sortedMonths) {
        const monthShifts = shiftsByMonth.get(monthKey)!;
        const [monthYear, monthNum] = monthKey.split("-");
        const monthDate = new Date(parseInt(monthYear), parseInt(monthNum) - 1);
        const monthName = monthDate.toLocaleDateString(locale, {
          month: "long",
          year: "numeric",
        });

        checkPageBreak(20);

        // Month header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(monthName, margin, yPosition);
        yPosition += 7;

        // Shifts for this month
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        for (const shift of monthShifts) {
          checkPageBreak(15);

          const shiftDate = shift.date as Date;
          const dateStr = shiftDate.toLocaleDateString(locale, {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
          });

          // Calendar color indicator (small rectangle)
          const calendarInfo = calendarMap.get(shift.calendarId);
          const rgb = hexToRgb(shift.color);
          doc.setFillColor(rgb.r, rgb.g, rgb.b);
          doc.rect(margin, yPosition - 2, 3, 3, "F");

          // Date
          doc.setFont("helvetica", "bold");
          doc.text(dateStr, margin + 6, yPosition);

          // Time
          doc.setFont("helvetica", "normal");
          const timeStr = shift.isAllDay
            ? "—" // Em dash for all-day shifts
            : `${shift.startTime} - ${shift.endTime}`;
          doc.text(timeStr, margin + 35, yPosition);

          // Calendar name (only for multi-calendar exports)
          if (isMultiCalendar) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.text(
              `[${calendarInfo?.name || "Unknown"}]`,
              margin + 70,
              yPosition
            );
          }

          // Shift title
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(
            shift.title,
            isMultiCalendar ? margin + 105 : margin + 70,
            yPosition
          );

          yPosition += 5;

          // Notes (if present)
          if (shift.notes) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            const notesLines = doc.splitTextToSize(
              shift.notes,
              pageWidth - margin * 2 - 10
            );
            for (const line of notesLines) {
              checkPageBreak(5);
              doc.text(line, margin + 10, yPosition);
              yPosition += 4;
            }
            doc.setFontSize(10);
            yPosition += 2;
          } else {
            yPosition += 3;
          }
        }

        yPosition += 5; // Extra space between months
      }
    }

    // Generate PDF
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // Create filename from calendar names (truncated)
    const calendarNamesParts = accessibleCalendars
      .map((c) =>
        c.name
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase()
          .substring(0, 20)
      )
      .slice(0, 3); // Max 3 calendar names

    const filename = `${calendarNamesParts.join("_")}_${
      new Date().toISOString().split("T")[0]
    }.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting calendars as PDF:", error);
    return NextResponse.json(
      { error: "Failed to export calendars" },
      { status: 500 }
    );
  }
}
