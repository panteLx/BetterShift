import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { jsPDF } from "jspdf";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar } from "@/lib/auth/permissions";
import { rateLimit } from "@/lib/rate-limiter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);

    // Rate limiting: 10 PDF exports per 10 minutes
    const rateLimitResponse = rateLimit(request, user?.id, "export-pdf");
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // Format: YYYY-MM
    const year = searchParams.get("year"); // Format: YYYY
    const locale = searchParams.get("locale") || "en"; // Default to English

    // Get calendar
    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, id),
    });

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check read permission (works for both authenticated users and guests)
    const hasAccess = await canViewCalendar(user?.id, id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get all shifts for this calendar
    let calendarShifts = await db.query.shifts.findMany({
      where: eq(shifts.calendarId, id),
      orderBy: (shifts, { asc }) => [asc(shifts.date)],
    });

    // Filter by month or year if provided
    if (month) {
      const [filterYear, filterMonth] = month.split("-").map(Number);
      calendarShifts = calendarShifts.filter((shift) => {
        const shiftDate = new Date(shift.date);
        return (
          shiftDate.getFullYear() === filterYear &&
          shiftDate.getMonth() + 1 === filterMonth
        );
      });
    } else if (year) {
      const filterYear = parseInt(year);
      calendarShifts = calendarShifts.filter((shift) => {
        const shiftDate = new Date(shift.date);
        return shiftDate.getFullYear() === filterYear;
      });
    }

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

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(calendar.name, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 10;

    // Date range
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (month || year) {
      const dateRangeText = month ? `${month}` : `${year}`;
      doc.text(dateRangeText, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 10;
    }

    // Horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    if (calendarShifts.length === 0) {
      // Empty state - no text needed, the date range shows the filter
      yPosition += 20;
    } else {
      // Group shifts by month
      const shiftsByMonth = new Map<string, typeof calendarShifts>();
      for (const shift of calendarShifts) {
        const shiftDate = new Date(shift.date);
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

          const shiftDate = new Date(shift.date);
          const dateStr = shiftDate.toLocaleDateString(locale, {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
          });

          // Color indicator (small rectangle)
          doc.setFillColor(shift.color);
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

          // Title
          doc.setFont("helvetica", "bold");
          doc.text(shift.title, margin + 70, yPosition);

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

        yPosition += 5;
      }
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // Return as downloadable file
    const filename = `${calendar.name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_${month || year || "all"}_${
      new Date().toISOString().split("T")[0]
    }.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting calendar as PDF:", error);
    return NextResponse.json(
      { error: "Failed to export calendar" },
      { status: 500 }
    );
  }
}
