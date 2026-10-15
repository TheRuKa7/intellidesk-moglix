/**
 * API conventions for /api/v1 — pagination, error shape, versioning.
 */
import { NextResponse } from 'next/server';

export const API_VERSION = 'v1';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: { version: string; request_id: string };
};

export type ApiSuccessBody<T> = {
  data: T;
  meta: {
    version: string;
    request_id: string;
    page?: number;
    page_size?: number;
    total?: number;
  };
};

function requestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function apiOk<T>(
  data: T,
  init?: { page?: number; pageSize?: number; total?: number; status?: number },
) {
  const body: ApiSuccessBody<T> = {
    data,
    meta: {
      version: API_VERSION,
      request_id: requestId(),
      page: init?.page,
      page_size: init?.pageSize,
      total: init?.total,
    },
  };
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'X-API-Version': API_VERSION },
  });
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: { code, message, details },
    meta: { version: API_VERSION, request_id: requestId() },
  };
  return NextResponse.json(body, {
    status,
    headers: { 'X-API-Version': API_VERSION },
  });
}

export function parsePagination(url: URL, defaults = { page: 1, pageSize: 25 }) {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? defaults.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('page_size') ?? defaults.pageSize) || defaults.pageSize),
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}
