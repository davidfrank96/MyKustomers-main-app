import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listBookingsForBusiness } from "@/features/bookings/queries";
import { parseBookingListParams } from "@/features/bookings/validation";
import { getAuthenticatedUser, getCurrentBusinessContext } from "@/lib/auth/server";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

const cursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return response({ status: "error", message: "Authentication is required." }, 401);
  }

  const businessContext = await getCurrentBusinessContext(user);
  if (!businessContext.currentBusiness) {
    return response({ status: "error", message: "A current business is required." }, 404);
  }

  const searchParams = request.nextUrl.searchParams;
  const cursor = cursorSchema.safeParse({
    createdAt: searchParams.get("cursorCreatedAt"),
    id: searchParams.get("cursorId"),
  });
  if (!cursor.success) {
    return response({ status: "error", message: "The list position is invalid." }, 400);
  }
  const params = parseBookingListParams({
    q: searchParams.get("q") ?? undefined,
    filter: searchParams.get("filter") ?? undefined,
    page: searchParams.get("page") ?? undefined,
  });
  const result = await listBookingsForBusiness(
    businessContext.currentBusiness.id,
    params,
    cursor.data,
  );

  return response({
    bookings: result.bookings,
    hasMore: result.total > result.bookings.length,
  });
}
