export type PaginationToken = number | 'ellipsis';

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function buildPaginationTokens(currentPage: number, totalPages: number, siblingCount = 1): PaginationToken[] {
  if (totalPages <= 0) {
    return [];
  }

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const totalVisibleSlots = siblingCount * 2 + 5;

  if (totalPages <= totalVisibleSlots) {
    return range(1, totalPages);
  }

  const leftSibling = Math.max(safeCurrentPage - siblingCount, 1);
  const rightSibling = Math.min(safeCurrentPage + siblingCount, totalPages);

  const shouldShowLeftEllipsis = leftSibling > 2;
  const shouldShowRightEllipsis = rightSibling < totalPages - 1;

  if (!shouldShowLeftEllipsis && shouldShowRightEllipsis) {
    const leftItemCount = 3 + siblingCount * 2;
    return [...range(1, leftItemCount), 'ellipsis', totalPages];
  }

  if (shouldShowLeftEllipsis && !shouldShowRightEllipsis) {
    const rightItemCount = 3 + siblingCount * 2;
    return [1, 'ellipsis', ...range(totalPages - rightItemCount + 1, totalPages)];
  }

  return [1, 'ellipsis', ...range(leftSibling, rightSibling), 'ellipsis', totalPages];
}
