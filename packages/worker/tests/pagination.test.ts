/**
 * Unit tests for pagination utility functions
 * 
 * These tests run in Node environment since pagination utilities
 * are pure TypeScript functions without Workers dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  parsePaginationParams,
  calculatePaginationMetadata,
  calculateLimitOffset,
  paginateArray,
} from '../src/lib/pagination';

describe('Pagination Utility Functions', () => {
  describe('parsePaginationParams', () => {
    it('should return default values when no parameters provided', () => {
      const result = parsePaginationParams(undefined, undefined);
      expect(result).toEqual({
        page: 1,
        page_size: 100,
      });
    });

    it('should parse valid page and page_size parameters', () => {
      const result = parsePaginationParams('2', '50');
      expect(result).toEqual({
        page: 2,
        page_size: 50,
      });
    });

    it('should use default page when invalid page provided', () => {
      const result = parsePaginationParams('invalid', '50');
      expect(result).toEqual({
        page: 1,
        page_size: 50,
      });
    });

    it('should use default page_size when invalid page_size provided', () => {
      const result = parsePaginationParams('2', 'invalid');
      expect(result).toEqual({
        page: 2,
        page_size: 100,
      });
    });

    it('should reject negative page numbers', () => {
      const result = parsePaginationParams('-1', '50');
      expect(result).toEqual({
        page: 1,
        page_size: 50,
      });
    });

    it('should reject zero page numbers', () => {
      const result = parsePaginationParams('0', '50');
      expect(result).toEqual({
        page: 1,
        page_size: 50,
      });
    });

    it('should reject negative page_size', () => {
      const result = parsePaginationParams('2', '-10');
      expect(result).toEqual({
        page: 2,
        page_size: 100,
      });
    });

    it('should cap page_size at maximum of 1000', () => {
      const result = parsePaginationParams('1', '5000');
      expect(result).toEqual({
        page: 1,
        page_size: 1000,
      });
    });

    it('should handle null parameters', () => {
      const result = parsePaginationParams(null, null);
      expect(result).toEqual({
        page: 1,
        page_size: 100,
      });
    });
  });

  describe('calculatePaginationMetadata', () => {
    it('should calculate metadata for first page', () => {
      const result = calculatePaginationMetadata(250, 1, 100);
      expect(result).toEqual({
        total: 250,
        page: 1,
        page_size: 100,
        total_pages: 3,
      });
    });

    it('should calculate metadata for middle page', () => {
      const result = calculatePaginationMetadata(250, 2, 100);
      expect(result).toEqual({
        total: 250,
        page: 2,
        page_size: 100,
        total_pages: 3,
      });
    });

    it('should calculate metadata for last page', () => {
      const result = calculatePaginationMetadata(250, 3, 100);
      expect(result).toEqual({
        total: 250,
        page: 3,
        page_size: 100,
        total_pages: 3,
      });
    });

    it('should handle exact division', () => {
      const result = calculatePaginationMetadata(300, 1, 100);
      expect(result).toEqual({
        total: 300,
        page: 1,
        page_size: 100,
        total_pages: 3,
      });
    });

    it('should handle single page', () => {
      const result = calculatePaginationMetadata(50, 1, 100);
      expect(result).toEqual({
        total: 50,
        page: 1,
        page_size: 100,
        total_pages: 1,
      });
    });

    it('should handle empty results', () => {
      const result = calculatePaginationMetadata(0, 1, 100);
      expect(result).toEqual({
        total: 0,
        page: 1,
        page_size: 100,
        total_pages: 0,
      });
    });

    it('should handle small page sizes', () => {
      const result = calculatePaginationMetadata(100, 5, 10);
      expect(result).toEqual({
        total: 100,
        page: 5,
        page_size: 10,
        total_pages: 10,
      });
    });
  });

  describe('calculateLimitOffset', () => {
    it('should calculate limit and offset for first page', () => {
      const result = calculateLimitOffset(1, 100);
      expect(result).toEqual({
        limit: 100,
        offset: 0,
      });
    });

    it('should calculate limit and offset for second page', () => {
      const result = calculateLimitOffset(2, 100);
      expect(result).toEqual({
        limit: 100,
        offset: 100,
      });
    });

    it('should calculate limit and offset for third page', () => {
      const result = calculateLimitOffset(3, 100);
      expect(result).toEqual({
        limit: 100,
        offset: 200,
      });
    });

    it('should handle small page sizes', () => {
      const result = calculateLimitOffset(5, 10);
      expect(result).toEqual({
        limit: 10,
        offset: 40,
      });
    });

    it('should handle page size of 1', () => {
      const result = calculateLimitOffset(10, 1);
      expect(result).toEqual({
        limit: 1,
        offset: 9,
      });
    });
  });

  describe('paginateArray', () => {
    const testArray = Array.from({ length: 250 }, (_, i) => i + 1);

    it('should return first page of results', () => {
      const result = paginateArray(testArray, 1, 100);
      expect(result).toHaveLength(100);
      expect(result[0]).toBe(1);
      expect(result[99]).toBe(100);
    });

    it('should return second page of results', () => {
      const result = paginateArray(testArray, 2, 100);
      expect(result).toHaveLength(100);
      expect(result[0]).toBe(101);
      expect(result[99]).toBe(200);
    });

    it('should return partial last page', () => {
      const result = paginateArray(testArray, 3, 100);
      expect(result).toHaveLength(50);
      expect(result[0]).toBe(201);
      expect(result[49]).toBe(250);
    });

    it('should return empty array for page beyond total', () => {
      const result = paginateArray(testArray, 10, 100);
      expect(result).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const result = paginateArray([], 1, 100);
      expect(result).toHaveLength(0);
    });

    it('should handle single item array', () => {
      const result = paginateArray([1], 1, 100);
      expect(result).toEqual([1]);
    });

    it('should handle page size larger than array', () => {
      const smallArray = [1, 2, 3];
      const result = paginateArray(smallArray, 1, 100);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle small page sizes', () => {
      const result = paginateArray(testArray, 5, 10);
      expect(result).toHaveLength(10);
      expect(result[0]).toBe(41);
      expect(result[9]).toBe(50);
    });

    it('should not mutate original array', () => {
      const original = [1, 2, 3, 4, 5];
      const result = paginateArray(original, 1, 2);
      expect(result).toEqual([1, 2]);
      expect(original).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large page numbers', () => {
      const params = parsePaginationParams('999999', '100');
      expect(params.page).toBe(999999);
    });

    it('should handle pagination of objects', () => {
      const objects = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
      ];
      const result = paginateArray(objects, 2, 2);
      expect(result).toEqual([
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
      ]);
    });

    it('should calculate correct total_pages for edge cases', () => {
      // 101 items with page_size 100 should give 2 pages
      const result1 = calculatePaginationMetadata(101, 1, 100);
      expect(result1.total_pages).toBe(2);

      // 99 items with page_size 100 should give 1 page
      const result2 = calculatePaginationMetadata(99, 1, 100);
      expect(result2.total_pages).toBe(1);

      // 1 item with page_size 100 should give 1 page
      const result3 = calculatePaginationMetadata(1, 1, 100);
      expect(result3.total_pages).toBe(1);
    });
  });
});
