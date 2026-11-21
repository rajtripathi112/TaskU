function Pagination({ page, pageCount, pageSize, total, onPageChange }) {
  if (pageCount <= 1) return null;

  const buttons = [];
  let previous = 0;
  for (let number = 1; number <= pageCount; number += 1) {
    if (number === 1 || number === pageCount || Math.abs(number - page) <= 1) {
      if (previous && number - previous > 1) {
        buttons.push(<span className="gap" key={`gap-${number}`}>…</span>);
      }
      buttons.push(
        <button
          className="pg"
          key={number}
          type="button"
          aria-label={`Page ${number}`}
          aria-current={number === page ? "page" : undefined}
          onClick={() => onPageChange(number)}
        >
          {number}
        </button>,
      );
      previous = number;
    }
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="pager">
      <span className="info">Showing {from}–{to} of {total} tasks</span>
      <nav className="pages" aria-label="Pagination">
        <button
          className="pg"
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </button>
        {buttons}
        <button
          className="pg"
          type="button"
          aria-label="Next page"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </nav>
    </div>
  );
}

export default Pagination;
