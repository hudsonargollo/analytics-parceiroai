import { PaginationParams, PaginationMetadata } from '../types';

/**
 * Parse and validate pagination parameters from query string
 * 
 * @param page - Page number from query string (1-indexed)
 * @param page_size - Page size from query string
 * @returns Validated pagination parameters with defaults
 */
export function parsePaginationParams(
  page?: string | null,
  page_size?: string | null
): Required<PaginationParams> {
  // Default values
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 100;
  const MAX_PAGE_SIZE = 1000;
  
  // Parse page number
  let parsedPage = DEFAULT_PAGE;
  if (page) {
    const pageNum = parseInt(page, 10);
    if (!isNaN(pageNum) && pageNum > 0) {
      parsedPage = pageNum;
    }
  }
  
  // Parse page size
  let parsedPageSize = DEFAULT_PAGE_SIZE;
  if (page_size) {
    const sizeNum = parseInt(page_size, 10);
    if (!isNaN(sizeNum) && sizeNum > 0) {
      // Cap at maximum page size
      parsedPageSize = Math.min(sizeNum, MAX_PAGE_SIZE);
    }
  }
  
  return {
    page: parsedPage,
    page_size: parsedPageSize,
  };
}

/**
 * Calculate pagination metadata
 * 
 * @param total - Total number of records
 * @param page - Current page number (1-indexed)
 * @param page_size - Number of records per page
 * @returns Pagination metadata
 */
export function calculatePaginationMetadata(
  total: number,
  page: number,
  page_size: number
): PaginationMetadata {
  const total_pages = Math.ceil(total / page_size);
  
  return {
    total,
    page,
    page_size,
    total_pages,
  };
}

/**
 * Calculate SQL LIMIT and OFFSET for pagination
 * 
 * @param page - Current page number (1-indexed)
 * @param page_size - Number of records per page
 * @returns Object with limit and offset values
 */
export function calculateLimitOffset(
  page: number,
  page_size: number
): { limit: number; offset: number } {
  const offset = (page - 1) * page_size;
  
  return {
    limit: page_size,
    offset,
  };
}

/**
 * Paginate an array of items
 * 
 * @param items - Array of items to paginate
 * @param page - Current page number (1-indexed)
 * @param page_size - Number of items per page
 * @returns Paginated subset of items
 */
export function paginateArray<T>(
  items: T[],
  page: number,
  page_size: number
): T[] {
  const { offset, limit } = calculateLimitOffset(page, page_size);
  return items.slice(offset, offset + limit);
}
