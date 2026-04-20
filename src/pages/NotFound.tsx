import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="detail">
      <div className="container">
        <div className="state">
          <h3>페이지를 찾을 수 없어요</h3>
          <p>
            <Link to="/" style={{ textDecoration: 'underline' }}>
              목록으로 돌아가기
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
