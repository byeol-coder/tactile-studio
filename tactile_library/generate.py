"""Tactile vector source generator (two-tier line weight) — Dot Space collection.

Produces simplified black-and-white outline SVGs for tactile graphics (DotPad /
SVG conversion) plus per-subject metadata and an image-generation prompt.

TACTILE HIERARCHY for easier perception by touch:
- `outline` elements → thick 11px stroke = primary silhouette/boundary
- `detail`  elements → lighter 6px stroke = 1–2 secondary feature cues

Add a subject to SUBJECTS and re-run to extend the library.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SVG_DIR = HERE / "svg"
SVG_DIR.mkdir(parents=True, exist_ok=True)

PROMPT_TEMPLATE = """Create a simplified black-and-white vector icon of {target} for tactile graphics.

Requirements:
- isolated object only
- no background
- no color
- no gradients
- no shadows
- no text
- thick clear outline (bold outer contour, lighter inner feature lines)
- simple geometric shape
- minimal internal details
- high contrast black and white
- tactile-readable silhouette
- designed for blind users to understand through touch
- suitable for DotPad tactile display and SVG conversion
- emphasize only the most recognizable features of the object

Style:
clean educational tactile graphic, accessible vector icon, simple outline, beginner-friendly tactile design"""

COLLECTION = "Dot Space Tactile"


def wrap(title: str, outline: str, detail: str = "") -> str:
    detail_group = (
        f'    <g stroke-width="6">\n{detail}\n    </g>\n' if detail.strip() else ""
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" '
        f'width="240" height="240" role="img" aria-label="{title}">\n'
        '  <g fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round">\n'
        f'    <g stroke-width="11">\n{outline}\n    </g>\n'
        f'{detail_group}'
        '  </g>\n</svg>\n'
    )


def S(key, target, title, category, tags, description, note, outline, detail=""):
    return {
        "key": key, "target": target, "title": title, "category": category,
        "tags": tags + ["space", "tactile graphic", "black and white", "vector",
                        "DotPad", "beginner"],
        "description": description, "note": note, "outline": outline, "detail": detail,
    }


SUBJECTS = [
    S("sun", "the sun", "Sun Tactile Vector", "Space / Star",
      ["sun", "star", "rays"],
      "둥근 해와 사방으로 뻗은 여덟 광선.",
      "둥근 본체와 방사형 광선을 굵게 강조해 해 특유의 형태를 손끝으로 즉시 인지하도록 했습니다.",
      """      <circle cx="120" cy="120" r="46"/>
      <path d="M178 120 L202 120"/>
      <path d="M161 161 L178 178"/>
      <path d="M120 178 L120 202"/>
      <path d="M79 161 L62 178"/>
      <path d="M62 120 L38 120"/>
      <path d="M79 79 L62 62"/>
      <path d="M120 62 L120 38"/>
      <path d="M161 79 L178 62"/>"""),

    S("full_moon", "the full moon", "Full Moon Tactile Vector", "Space / Star",
      ["moon", "full moon", "craters"],
      "둥근 보름달과 표면의 크레이터 세 개.",
      "큰 원으로 보름달을 강조하고, 크레이터는 가는 선으로 살짝 넣어 달 표면을 인지하게 했습니다.",
      """      <circle cx="120" cy="120" r="74"/>""",
      """      <circle cx="98" cy="96" r="11"/>
      <circle cx="150" cy="132" r="15"/>
      <circle cx="112" cy="156" r="8"/>"""),

    S("crescent_moon", "a crescent moon", "Crescent Moon Tactile Vector", "Space / Star",
      ["moon", "crescent", "night"],
      "한쪽이 파인 초승달 모양.",
      "초승달의 파인 곡선을 굵은 단일 외곽선으로 명확히 해 보름달과 구분되게 했습니다.",
      """      <path d="M150 38 A90 90 0 1 0 150 202 A66 66 0 1 1 150 38 Z"/>"""),

    S("earth", "planet Earth", "Earth Tactile Vector", "Space / Planet",
      ["earth", "planet", "globe", "continents"],
      "둥근 지구와 대륙 두 덩어리, 적도선.",
      "구체를 굵게, 대륙과 적도선을 가는 선으로 넣어 지구임을 분명히 했습니다.",
      """      <circle cx="120" cy="120" r="74"/>""",
      """      <path d="M84 82 Q112 74 120 96 Q114 118 88 112 Q74 96 84 82 Z"/>
      <path d="M132 132 Q162 126 166 150 Q156 174 128 164 Q120 144 132 132 Z"/>
      <path d="M48 122 Q120 140 192 122"/>"""),

    S("saturn", "planet Saturn with rings", "Saturn Tactile Vector", "Space / Planet",
      ["saturn", "planet", "rings"],
      "고리를 두른 토성. 본체와 비스듬한 고리 타원.",
      "구체와 비스듬한 고리를 굵게 강조해 토성 특유의 실루엣을 손끝으로 즉시 알게 했습니다.",
      """      <ellipse cx="120" cy="112" rx="86" ry="26" transform="rotate(-18 120 112)"/>
      <circle cx="120" cy="112" r="46"/>"""),

    S("star", "a five-pointed star", "Star Tactile Vector", "Space / Star",
      ["star", "five points"],
      "다섯 꼭짓점의 별.",
      "다섯 꼭짓점의 규칙적 형태만 굵은 외곽선으로 남겨 별을 또렷이 셀 수 있게 했습니다.",
      """      <polygon points="120,28 142,89 207,92 156,132 174,194 120,158 66,194 84,132 33,92 98,89"/>"""),

    S("rocket", "a rocket", "Rocket Tactile Vector", "Space / Vehicle",
      ["rocket", "spaceship", "launch"],
      "뾰족한 머리의 로켓 몸체와 두 날개. 가는 선으로 창과 화염.",
      "로켓 몸체와 꼬리 날개를 굵게 강조하고, 창문과 화염을 가는 선으로 넣어 로켓임을 분명히 했습니다.",
      """      <path d="M120 36 C150 70 150 120 142 168 L98 168 C90 120 90 70 120 36 Z"/>
      <path d="M98 150 L72 196 L98 176"/>
      <path d="M142 150 L168 196 L142 176"/>""",
      """      <circle cx="120" cy="94" r="14"/>
      <path d="M108 170 L112 200"/>
      <path d="M120 172 L120 206"/>
      <path d="M132 170 L128 200"/>"""),

    S("satellite", "an artificial satellite", "Satellite Tactile Vector", "Space / Vehicle",
      ["satellite", "solar panels", "antenna"],
      "중앙 본체와 양쪽 태양전지판, 안테나.",
      "본체와 양 날개(태양전지판), 안테나를 굵게 강조하고, 패널 격자선은 가는 선으로 넣었습니다.",
      """      <rect x="104" y="96" width="32" height="48"/>
      <rect x="34" y="104" width="52" height="32"/>
      <rect x="154" y="104" width="52" height="32"/>
      <path d="M120 96 L120 66"/>
      <path d="M106 70 Q120 56 134 70"/>""",
      """      <path d="M60 104 L60 136"/>
      <path d="M180 104 L180 136"/>
      <path d="M86 120 L104 120"/>
      <path d="M136 120 L154 120"/>"""),

    S("astronaut", "an astronaut", "Astronaut Tactile Vector", "Space / Being",
      ["astronaut", "spacesuit", "helmet"],
      "헬멧을 쓴 우주인. 몸통·팔·다리. 가는 선으로 바이저와 가슴 패널.",
      "둥근 헬멧과 수트 실루엣을 굵게 강조하고, 바이저와 가슴 패널을 가는 선으로 넣었습니다.",
      """      <circle cx="120" cy="74" r="34"/>
      <path d="M92 104 Q92 96 102 96 L138 96 Q148 96 148 104 L150 168 Q150 180 138 180 L102 180 Q90 180 90 168 Z"/>
      <path d="M92 116 L62 150 L74 168"/>
      <path d="M148 116 L178 150 L166 168"/>
      <path d="M104 180 L100 216"/>
      <path d="M136 180 L140 216"/>""",
      """      <path d="M100 74 Q120 92 140 74"/>
      <rect x="108" y="120" width="24" height="18"/>"""),

    S("telescope", "a telescope", "Telescope Tactile Vector", "Space / Tool",
      ["telescope", "observation", "tripod"],
      "비스듬한 망원경 통과 삼각대 다리. 가는 선으로 접안·대물 렌즈.",
      "비스듬한 통과 삼각대를 굵게 강조하고, 양 끝 렌즈를 가는 선으로 넣어 망원경임을 분명히 했습니다.",
      """      <path d="M66 146 L150 62 L172 84 L88 168 Z"/>
      <path d="M120 150 L92 210"/>
      <path d="M120 150 L148 210"/>
      <path d="M120 150 L120 208"/>""",
      """      <circle cx="78" cy="158" r="9"/>
      <circle cx="160" cy="74" r="9"/>"""),

    S("comet", "a comet", "Comet Tactile Vector", "Space / Phenomenon",
      ["comet", "tail", "ice"],
      "둥근 핵과 길게 뻗은 꼬리 세 줄기.",
      "둥근 핵과 한 방향으로 뻗은 꼬리를 굵게 강조해 혜성의 움직임을 손끝으로 느끼게 했습니다.",
      """      <circle cx="170" cy="80" r="26"/>
      <path d="M150 92 Q90 130 40 180"/>
      <path d="M158 100 Q104 138 60 196"/>
      <path d="M146 76 Q86 104 36 150"/>"""),

    S("planet", "a planet with a moon", "Planet Tactile Vector", "Space / Planet",
      ["planet", "moon", "orbit"],
      "큰 행성과 작은 위성, 궤도선. 가는 선으로 표면 띠.",
      "큰 구체와 작은 위성을 굵게 강조하고, 궤도와 표면 띠는 가는 선으로 넣었습니다.",
      """      <circle cx="106" cy="122" r="58"/>
      <circle cx="192" cy="66" r="14"/>""",
      """      <ellipse cx="120" cy="118" rx="96" ry="42" transform="rotate(20 120 118)"/>
      <path d="M54 112 Q106 128 158 112"/>"""),

    S("galaxy", "a spiral galaxy", "Galaxy Tactile Vector", "Space / Phenomenon",
      ["galaxy", "spiral", "stars"],
      "두 갈래로 휘감기는 나선 은하와 중심.",
      "나선 팔과 밝은 중심을 굵게 강조해 은하의 소용돌이 형태를 손끝으로 따라가게 했습니다.",
      """      <path d="M120 120 C150 110 172 132 168 162 C164 192 126 198 100 184"/>
      <path d="M120 120 C90 130 68 108 72 78 C76 48 114 42 140 56"/>
      <circle cx="120" cy="120" r="11"/>""",
      """      <circle cx="160" cy="152" r="4"/>
      <circle cx="80" cy="88" r="4"/>"""),

    S("ufo", "a flying saucer UFO", "UFO Tactile Vector", "Space / Vehicle",
      ["ufo", "flying saucer", "alien craft"],
      "납작한 접시 몸체와 위쪽 돔. 가는 선으로 불빛과 광선.",
      "접시 몸체와 돔을 굵게 강조하고, 아래쪽 불빛과 광선을 가는 선으로 넣었습니다.",
      """      <ellipse cx="120" cy="140" rx="78" ry="26"/>
      <path d="M84 132 Q120 94 156 132"/>""",
      """      <circle cx="92" cy="150" r="6"/>
      <circle cx="120" cy="154" r="6"/>
      <circle cx="148" cy="150" r="6"/>
      <path d="M104 162 L88 206"/>
      <path d="M136 162 L152 206"/>"""),

    S("space_shuttle", "a space shuttle", "Space Shuttle Tactile Vector", "Space / Vehicle",
      ["space shuttle", "spacecraft", "wings"],
      "위에서 본 우주왕복선. 뾰족한 기수와 삼각 날개. 가는 선으로 조종창·중심선.",
      "기수와 델타 날개의 실루엣을 굵게 강조하고, 창과 중심선을 가는 선으로 넣었습니다.",
      """      <path d="M120 36 C134 56 138 104 138 146 L150 146 L172 198 L120 178 L68 198 L90 146 L102 146 C102 104 106 56 120 36 Z"/>""",
      """      <path d="M112 60 Q120 52 128 60"/>
      <path d="M120 62 L120 168"/>"""),

    S("meteor", "a meteor shooting through space", "Meteor Tactile Vector", "Space / Phenomenon",
      ["meteor", "shooting star", "streak"],
      "둥근 운석 덩어리와 평행한 자취 세 줄.",
      "운석 덩어리와 평행한 직선 자취를 굵게 강조해 빠르게 떨어지는 느낌을 주었습니다.",
      """      <circle cx="170" cy="80" r="24"/>
      <path d="M150 94 L94 150"/>
      <path d="M164 68 L108 124"/>
      <path d="M140 100 L90 150"/>""",
      """      <circle cx="162" cy="74" r="6"/>
      <circle cx="176" cy="88" r="5"/>"""),

    S("constellation", "a star constellation", "Constellation Tactile Vector", "Space / Star",
      ["constellation", "stars", "lines"],
      "선으로 이어진 여섯 개의 별.",
      "별을 잇는 선을 굵게 강조하고, 각 별점은 가는 선으로 찍어 별자리를 손끝으로 따라가게 했습니다.",
      """      <polyline points="48,172 90,150 132,160 162,128 150,86 110,68"/>""",
      """      <circle cx="48" cy="172" r="6"/>
      <circle cx="90" cy="150" r="6"/>
      <circle cx="132" cy="160" r="6"/>
      <circle cx="162" cy="128" r="6"/>
      <circle cx="150" cy="86" r="6"/>
      <circle cx="110" cy="68" r="6"/>"""),

    S("orbit", "orbital paths around a center", "Orbit Tactile Vector", "Space / Phenomenon",
      ["orbit", "orbital paths", "system"],
      "중심 둘레를 도는 세 개의 타원 궤도와 점.",
      "겹친 타원 궤도와 중심을 굵게 강조하고, 궤도 위의 천체는 가는 선 점으로 넣었습니다.",
      """      <circle cx="120" cy="120" r="12"/>
      <ellipse cx="120" cy="120" rx="88" ry="32"/>
      <ellipse cx="120" cy="120" rx="88" ry="32" transform="rotate(60 120 120)"/>
      <ellipse cx="120" cy="120" rx="88" ry="32" transform="rotate(120 120 120)"/>""",
      """      <circle cx="208" cy="120" r="7"/>
      <circle cx="76" cy="46" r="7"/>
      <circle cx="76" cy="194" r="7"/>"""),

    S("alien", "a friendly alien", "Alien Tactile Vector", "Space / Being",
      ["alien", "extraterrestrial", "big eyes"],
      "큰 머리와 작은 몸의 외계인. 가는 선으로 큰 눈 두 개와 입.",
      "넓은 머리 실루엣을 굵게 강조하고, 큰 눈과 작은 입을 가는 선으로 넣어 외계인 인상을 주었습니다.",
      """      <path d="M120 40 C160 40 170 90 158 130 C150 160 130 178 120 178 C110 178 90 160 82 130 C70 90 80 40 120 40 Z"/>
      <path d="M104 178 Q104 202 120 202 Q136 202 136 178"/>""",
      """      <ellipse cx="100" cy="108" rx="12" ry="20" transform="rotate(18 100 108)"/>
      <ellipse cx="140" cy="108" rx="12" ry="20" transform="rotate(-18 140 108)"/>
      <path d="M112 148 Q120 154 128 148"/>"""),

    S("asteroid", "an asteroid", "Asteroid Tactile Vector", "Space / Phenomenon",
      ["asteroid", "rock", "craters"],
      "울퉁불퉁한 소행성 덩어리와 크레이터 세 개.",
      "불규칙한 외곽을 굵게 강조하고, 크레이터를 가는 선으로 넣어 거친 암석 느낌을 주었습니다.",
      """      <polygon points="60,100 90,62 140,56 184,90 192,140 160,184 110,190 70,160 46,128"/>""",
      """      <circle cx="100" cy="108" r="11"/>
      <circle cx="150" cy="120" r="14"/>
      <circle cx="118" cy="160" r="8"/>"""),
]


def build() -> list[dict]:
    manifest, cells = [], []
    for s in SUBJECTS:
        fname = f"{s['key']}_tactile_vector.svg"
        svg = wrap(s["title"], s["outline"], s.get("detail", ""))
        (SVG_DIR / fname).write_text(svg, encoding="utf-8")
        manifest.append({
            "file_name": fname,
            "title": s["title"],
            "category": s["category"],
            "collection": COLLECTION,
            "tags": s["tags"],
            "description": s["description"],
            "tactile_design_note": s["note"],
            "generation_prompt": PROMPT_TEMPLATE.format(target=s["target"]),
        })
        cells.append(
            f'<figure class="cell"><div class="art">{svg}</div>'
            f'<figcaption><b>{s["title"]}</b><br><span>{s["category"]}</span><br>'
            f'<code>{fname}</code></figcaption></figure>'
        )

    (HERE / "library.json").write_text(
        json.dumps({"collection": COLLECTION, "count": len(manifest), "items": manifest},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    fragment = (
        '<style>.sheet{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));'
        'gap:12px}.cell{background:#fff;border:1px solid #d8e0ea;border-radius:12px;padding:10px;'
        'margin:0;text-align:center}.cell .art svg{width:108px;height:108px}'
        '.cell figcaption{font-size:11px;color:#0b1f3a;margin-top:6px;line-height:1.4}'
        '.cell code{font-size:10px;color:#5b6b80}</style>'
        f'<div class="sheet">{"".join(cells)}</div>'
    )
    (HERE / "contact_sheet_fragment.html").write_text(fragment, encoding="utf-8")
    return manifest


if __name__ == "__main__":
    m = build()
    print(f"{len(m)} tactile vectors generated -> {SVG_DIR}")
    for item in m:
        print(" -", item["file_name"], "|", item["category"])
