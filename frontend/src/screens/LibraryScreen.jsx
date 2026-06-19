import { useEffect, useState } from "react";
import { api } from "../api.js";

// Rasterize an SVG string to a PNG File so it can run through the same
// upload→convert pipeline as any other image.
function svgToPngFile(svgText, name) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const size = 480;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => {
        if (!blob) return reject(new Error("rasterize 실패"));
        resolve(new File([blob], name.replace(".svg", ".png"), { type: "image/png" }));
      }, "image/png");
    };
    img.onerror = () => reject(new Error("SVG 로드 실패"));
    img.src = url;
  });
}

export default function LibraryScreen({ onUpload, busy }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");

  useEffect(() => {
    api.listLibrary().then(setData).catch((e) => setError(e.message));
  }, []);

  async function convert(item) {
    setWorking(item.file_name);
    setError("");
    try {
      const svg = await api.librarySvg(item.file_name);
      const file = await svgToPngFile(svg, item.file_name);
      await onUpload(file); // reuses the main pipeline + navigates to analysis
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking("");
    }
  }

  if (error) return <div className="alert error" role="alert">라이브러리 오류: {error}</div>;
  if (!data) return <div className="alert info">라이브러리 불러오는 중…</div>;

  return (
    <section aria-labelledby="lib-h">
      <h2 id="lib-h">촉각 도안 라이브러리</h2>
      <p className="lead">
        {data.collection || "Tactile"} 컬렉션 · {data.count}종. 흑백 2단 굵기 벡터입니다.
        도안을 고르면 변환 파이프라인을 거쳐 DotPad 매트릭스·음성·QA까지 생성됩니다.
      </p>

      <div className="lib-grid">
        {data.items.map((it) => (
          <figure className="lib-card" key={it.file_name}>
            <img
              className="lib-art"
              src={api.librarySvgUrl(it.file_name)}
              alt={it.title}
              loading="lazy"
            />
            <figcaption>
              <strong>{it.title}</strong>
              <span className="muted">{it.category}</span>
            </figcaption>
            <button
              className="btn primary tiny"
              disabled={busy || working}
              onClick={() => convert(it)}
            >
              {working === it.file_name ? "변환 중…" : "촉각 변환 →"}
            </button>
          </figure>
        ))}
      </div>
    </section>
  );
}
