import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BUSINESS_LOGO_BUCKET,
  BUSINESS_LOGO_OUTPUT_MIME,
  BusinessLogoValidationError,
  MAX_LOGO_INPUT_BYTES,
  businessLogoPath,
  optimizeBusinessLogo,
} from "@/features/businesses/logo";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import {
  AuthorizationError,
  getAuthenticatedUser,
  requireBusinessRole,
} from "@/lib/auth/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";

const businessIdSchema = z.string().uuid();
const REQUEST_OVERHEAD_BYTES = 64 * 1024;

type RouteContext = {
  params: Promise<{ businessId: string }>;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status });
}

async function authorizeOwner(context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { response: errorResponse("Authentication is required.", 401) } as const;
  }

  const parsedBusinessId = businessIdSchema.safeParse((await context.params).businessId);
  if (!parsedBusinessId.success) {
    return { response: errorResponse("Business was not found.", 404) } as const;
  }

  try {
    await requireBusinessRole(parsedBusinessId.data, ["owner"], user);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { response: errorResponse("You cannot change this business logo.", 403) } as const;
    }
    throw error;
  }

  return { user, businessId: parsedBusinessId.data } as const;
}

function revalidateBusinessIdentity() {
  revalidatePath("/dashboard");
  revalidatePath("/business");
  revalidatePath("/c/[token]", "page");
}

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeOwner(context);
  if ("response" in authorization) {
    return authorization.response;
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_LOGO_INPUT_BYTES + REQUEST_OVERHEAD_BYTES) {
    return errorResponse("Logo source files must be 2 MB or smaller.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("The logo upload could not be read.", 400);
  }

  const file = formData.get("logo");
  if (!(file instanceof File)) {
    return errorResponse("Choose a logo image to upload.", 400);
  }
  if (file.size > MAX_LOGO_INPUT_BYTES) {
    return errorResponse("Logo source files must be 2 MB or smaller.", 413);
  }

  let optimized;
  try {
    optimized = await optimizeBusinessLogo({
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      fileName: file.name,
    });
  } catch (error) {
    if (error instanceof BusinessLogoValidationError) {
      return errorResponse(error.message, 400);
    }
    return errorResponse("The logo could not be processed.", 400);
  }

  const supabase = await createClient();
  const path = businessLogoPath(authorization.businessId);
  const { data: previousBusiness, error: previousBusinessError } = await supabase
    .from("businesses")
    .select("logo_path")
    .eq("id", authorization.businessId)
    .single();

  if (previousBusinessError) {
    return errorResponse("Business logo settings could not be loaded.", 500);
  }

  const { error: uploadError } = await supabase.storage
    .from(BUSINESS_LOGO_BUCKET)
    .upload(path, optimized.buffer, {
      cacheControl: "0",
      contentType: BUSINESS_LOGO_OUTPUT_MIME,
      upsert: true,
    });

  if (uploadError) {
    return errorResponse("The optimized logo could not be stored.", 500);
  }

  const { error: updateError } = await supabase
    .from("businesses")
    .update({ logo_path: path })
    .eq("id", authorization.businessId);

  if (updateError) {
    if (!previousBusiness.logo_path) {
      await supabase.storage.from(BUSINESS_LOGO_BUCKET).remove([path]);
    }
    return errorResponse("The business logo reference could not be saved.", 500);
  }

  await recordAuditEvent({
    actorUserId: authorization.user.id,
    businessId: authorization.businessId,
    eventType: "BUSINESS_UPDATED",
    metadata: {
      changed_fields: ["logo_path"],
      logo_operation: previousBusiness.logo_path ? "replaced" : "uploaded",
      persisted_bytes: optimized.size,
      width: optimized.width,
      height: optimized.height,
    },
  });

  revalidateBusinessIdentity();

  return NextResponse.json({
    status: "success",
    message: previousBusiness.logo_path ? "Business logo replaced." : "Business logo uploaded.",
    logoPath: path,
    logoUrl: getBusinessLogoPublicUrl(path),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authorization = await authorizeOwner(context);
  if ("response" in authorization) {
    return authorization.response;
  }

  const supabase = await createClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("logo_path")
    .eq("id", authorization.businessId)
    .single();

  if (businessError) {
    return errorResponse("Business logo settings could not be loaded.", 500);
  }

  if (!business.logo_path) {
    return NextResponse.json({
      status: "success",
      message: "Business logo is already removed.",
      logoPath: null,
      logoUrl: null,
    });
  }

  const { error: updateError } = await supabase
    .from("businesses")
    .update({ logo_path: null })
    .eq("id", authorization.businessId);

  if (updateError) {
    return errorResponse("The business logo reference could not be cleared.", 500);
  }

  const { error: cleanupError } = await supabase.storage
    .from(BUSINESS_LOGO_BUCKET)
    .remove([business.logo_path]);

  await recordAuditEvent({
    actorUserId: authorization.user.id,
    businessId: authorization.businessId,
    eventType: "BUSINESS_UPDATED",
    metadata: {
      changed_fields: ["logo_path"],
      logo_operation: "removed",
      storage_cleanup: cleanupError ? "failed" : "completed",
    },
  });

  revalidateBusinessIdentity();

  return NextResponse.json({
    status: "success",
    message: cleanupError
      ? "Logo removed. Stored-file cleanup needs a retry."
      : "Business logo removed.",
    cleanupPending: Boolean(cleanupError),
    logoPath: null,
    logoUrl: null,
  });
}
