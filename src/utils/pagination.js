export function getPagination(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 50);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function buildPaginationMeta({ page, pageSize, total }) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1)
  };
}
