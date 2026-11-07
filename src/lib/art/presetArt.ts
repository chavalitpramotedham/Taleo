// Reference paintings ("model sheets") for the preset characters, drawn on a
// 200x200 canvas with feet/base at y≈190. They use exactly the same layered
// markup Claude uses when it paints story pages:
//   <g class="paint">  watercolour fills  (rendered with the tl-paint filter)
//   <g class="ink">    fine sepia linework (rendered with the tl-ink filter)
//   <g class="detail"> crisp eyes / tiny highlights (no filter)
// Each character is shown in a lively, characterful pose (gesturing limbs,
// eyebrows, open expressions), so they read as storybook characters. They are
// shown in the character picker and sent to Claude as visual references so
// each character stays recognisable from page to page.

const INK = `class="ink" fill="none" stroke="#4F3A2A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"`;
const SHADOW = `<ellipse cx="100" cy="191" rx="62" ry="6" fill="#CFC6AC" opacity="0.6"/>`;
const MOUTH = "#6E3B32";
const TONGUE = "#C9786E";
const BLUSH = "#E7A99A";

/** Round open eye with a highlight. */
const eye = (x: number, y: number, r = 3.3) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#2A1E15"/><circle cx="${(x + r * 0.32).toFixed(1)}" cy="${(y - r * 0.32).toFixed(1)}" r="${(r * 0.32).toFixed(1)}" fill="#FFFFFF"/>`;
/** Oval eye (taller than wide) with a highlight. */
const ovalEye = (x: number, y: number, rx = 3.4, ry = 4.4) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#2A1E15"/><circle cx="${x + rx * 0.35}" cy="${y - ry * 0.4}" r="${(rx * 0.38).toFixed(1)}" fill="#FFFFFF"/>`;
/** Laughing / blissful closed eye, as an ink arc (put inside an ink group). */
const happyEye = (x: number, y: number, w = 6) => `<path d="M${x - w} ${y + 1.5} Q${x} ${y - w + 0.5} ${x + w} ${y + 1.5}" stroke-width="1.7"/>`;
const blush = (x: number, y: number, rx = 6, ry = 3.2) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${BLUSH}" opacity="0.5"/>`;
/** Short parallel pen strokes for shading. */
const hatch = (x: number, y: number, n: number, gap: number, dx: number, dy: number) =>
  `<path d="${Array.from({ length: n }, (_, i) => `M${x + i * gap} ${y} l${dx} ${dy}`).join(" ")}" stroke-width="0.8"/>`;

export const PRESET_ART: Record<string, string> = {
  // Pip waves hello with one paw, the other on a hip, head cocked, ears up.
  bunny: `
<g class="paint">${SHADOW}
<ellipse cx="80" cy="186" rx="19" ry="6" fill="#9C7756"/><ellipse cx="120" cy="187" rx="19" ry="6" fill="#9C7756"/>
<circle cx="66" cy="160" r="10" fill="#F4EFE4"/>
<ellipse cx="86" cy="164" rx="16" ry="20" fill="#9C7756"/><ellipse cx="116" cy="166" rx="16" ry="20" fill="#A98463"/>
<path d="M76 170 C68 142 74 110 96 100 C116 94 132 106 134 130 C136 152 128 170 112 176 C98 180 82 178 76 170Z" fill="#A98463"/>
<path d="M92 170 C86 150 88 122 102 112 C116 116 122 138 118 160 C116 172 104 176 92 170Z" fill="#E9DCC5"/>
<path d="M88 112 C74 118 62 128 64 138 C66 146 76 148 84 146 L86 138 C80 138 76 136 76 132 C78 126 84 122 92 120Z" fill="#9C7756"/>
<path d="M120 112 C132 100 144 86 150 72 C153 64 164 66 162 74 C158 90 144 106 128 120Z" fill="#A98463"/>
<ellipse cx="157" cy="67" rx="7" ry="8" fill="#A98463"/>
<path d="M88 56 C78 30 78 8 86 5 C95 3 100 28 101 54Z" fill="#9C7756"/>
<path d="M90 50 C84 32 84 16 88 13 C92 14 95 32 96 50Z" fill="#D9B8A0"/>
<path d="M107 52 C113 28 124 9 132 13 C139 18 127 41 116 58Z" fill="#A98463"/>
<path d="M110 50 C116 33 124 20 129 21 C132 25 124 40 116 54Z" fill="#D9B8A0"/>
<ellipse cx="105" cy="74" rx="29" ry="25" transform="rotate(-10 105 74)" fill="#A98463"/>
<ellipse cx="118" cy="86" rx="13" ry="9" fill="#E9DCC5"/>
<ellipse cx="88" cy="88" rx="9" ry="6" fill="#E9DCC5" opacity="0.7"/>
</g>
<g ${INK}>
<path d="M76 170 C68 142 74 110 92 100"/>
<path d="M130 116 C135 134 134 156 124 170"/>
<path d="M70 168 C70 152 78 146 88 146 M102 178 C100 160 106 148 118 148"/>
<path d="M62 186 C64 180 80 178 98 186 M102 188 C104 182 122 180 138 188"/>
<path d="M68 184 l2 -3 M74 183 l2 -3 M120 186 l2 -3 M126 185 l2 -3" stroke-width="0.9"/>
<path d="M88 112 C74 118 62 128 64 138 C66 146 76 148 84 146"/>
<path d="M120 112 C132 100 144 86 150 72 M162 74 C158 90 144 106 128 120"/>
<path d="M151 62 C152 58 158 58 160 61 M150 68 l3 0 M151 72 l3 -1" stroke-width="0.9"/>
<path d="M78 84 C74 64 86 50 104 49 C124 48 136 62 134 80 C132 94 120 100 106 101 C94 101 82 96 78 84"/>
<path d="M88 56 C78 30 78 8 86 5 C95 3 100 28 101 54"/>
<path d="M107 52 C113 28 124 9 132 13 C139 18 127 41 116 58"/>
<path d="M92 66 q5 -5 11 -2 M113 62 q6 -4 11 0" stroke-width="1.5"/>
<path d="M112 90 C114 98 126 98 129 89 C122 92 117 92 112 90Z" fill="${MOUTH}"/>
<path d="M120 80 C121 84 122 86 121 89" stroke-width="1"/>
<path d="M131 82 l16 -4 M131 85 l16 2 M130 88 l13 6" stroke-width="0.7"/>
<path d="M84 124 l3 -4 M80 132 l3 -4 M110 104 l3 -3 M126 108 l3 -3" stroke-width="0.8"/>
${hatch(72, 152, 4, 3.5, 3, 8)}
${hatch(110, 168, 3, 3.5, 3, 6)}
<path d="M168 56 q6 4 4 12 M172 50 q10 8 6 22" stroke-width="1"/>
</g>
<g class="detail">${ovalEye(101, 72)}${ovalEye(121, 69)}<ellipse cx="128" cy="81" rx="3" ry="2.3" fill="#B97E73"/><path d="M118 93 C120 96 124 96 126 93 C123 94 121 94 118 93Z" fill="${TONGUE}"/>${blush(96, 84)}${blush(128, 88, 4, 2.6)}</g>`,

  // Bobo flings his arms wide — "Ta-da!" — eyes squeezed shut with delight.
  bear: `
<g class="paint">${SHADOW}
<ellipse cx="80" cy="186" rx="17" ry="7" fill="#7A5A40"/><ellipse cx="122" cy="186" rx="17" ry="7" fill="#7A5A40"/>
<ellipse cx="84" cy="170" rx="16" ry="17" fill="#8E6A4C"/><ellipse cx="118" cy="170" rx="16" ry="17" fill="#8E6A4C"/>
<path d="M70 118 C56 110 40 98 30 86 C25 79 32 72 38 77 C50 88 64 98 80 106Z" fill="#8E6A4C"/>
<path d="M130 118 C144 110 160 98 170 86 C175 79 168 72 162 77 C150 88 136 98 120 106Z" fill="#8E6A4C"/>
<circle cx="32" cy="79" r="9" fill="#7A5A40"/><circle cx="168" cy="79" r="9" fill="#7A5A40"/>
<path d="M62 150 C58 118 76 98 100 98 C124 98 142 118 138 150 C136 172 118 182 100 182 C82 182 64 172 62 150Z" fill="#8E6A4C"/>
<ellipse cx="100" cy="148" rx="24" ry="26" fill="#C9AC88"/>
<circle cx="74" cy="44" r="12" fill="#8E6A4C"/><circle cx="74" cy="44" r="6" fill="#C9AC88"/>
<circle cx="126" cy="44" r="12" fill="#8E6A4C"/><circle cx="126" cy="44" r="6" fill="#C9AC88"/>
<circle cx="100" cy="70" r="33" fill="#8E6A4C"/>
<ellipse cx="100" cy="84" rx="17" ry="13" fill="#C9AC88"/>
<ellipse cx="80" cy="186" rx="8" ry="4" fill="#C9AC88"/><ellipse cx="122" cy="186" rx="8" ry="4" fill="#C9AC88"/>
</g>
<g ${INK}>
<path d="M62 150 C60 130 66 114 76 106 M124 106 C134 114 140 130 138 150 C136 172 118 182 100 182 C82 182 64 172 62 150"/>
<path d="M70 118 C56 110 40 98 30 86 M80 106 C66 98 52 88 40 77 M130 118 C144 110 160 98 170 86 M120 106 C134 98 148 88 160 77"/>
<path d="M25 76 l-4 -3 M27 72 l-3 -5 M33 70 l0 -5 M175 76 l4 -3 M173 72 l3 -5 M167 70 l0 -5" stroke-width="1"/>
<path d="M67 70 C67 50 82 37 100 37 C118 37 133 50 133 70 C133 90 118 103 100 103 C82 103 67 90 67 70"/>
<path d="M63 40 C64 32 78 30 82 38 M118 38 C122 30 136 32 137 40"/>
<path d="M66 186 C68 178 90 178 96 186 M106 186 C112 178 134 178 136 186"/>
${happyEye(87, 66)}${happyEye(113, 66)}
<path d="M80 56 q6 -4 12 -1 M108 55 q6 -3 12 1" stroke-width="1.4"/>
<path d="M89 88 C92 102 108 102 111 88 C104 92 96 92 89 88Z" fill="${MOUTH}"/>
<path d="M86 124 q6 3 12 0 M102 124 q6 3 12 0 M90 168 q10 4 20 0" stroke="#A88D6A" stroke-width="1"/>
<path d="M84 48 l2 -4 M114 46 l2 -4 M70 140 l-3 4 M132 140 l3 4" stroke-width="0.8"/>
${hatch(66, 156, 4, 3.5, 3, 9)}${hatch(126, 156, 4, 3.5, -3, 9)}
<path d="M18 62 l-6 -6 M22 56 l-2 -8 M182 62 l6 -6 M178 56 l2 -8" stroke-width="1.1"/>
</g>
<g class="detail"><ellipse cx="100" cy="79" rx="5.5" ry="3.8" fill="#3A2A20"/><circle cx="98" cy="78" r="1.2" fill="#fff" opacity="0.6"/><path d="M95 96 C98 99 102 99 105 96 C102 97 98 97 95 96Z" fill="${TONGUE}"/>${blush(78, 80)}${blush(122, 80)}</g>`,

  // Miso rears up with paws curled — "Boo!" — one brow cocked, mouth open in a cheeky mew.
  kitty: `
<g class="paint">${SHADOW}
<path d="M120 172 C150 170 160 142 148 126 C140 116 148 102 160 106" fill="none" stroke="#D99A5B" stroke-width="12" stroke-linecap="round"/>
<ellipse cx="86" cy="187" rx="11" ry="5" fill="#F3DDC0"/><ellipse cx="114" cy="187" rx="11" ry="5" fill="#F3DDC0"/>
<ellipse cx="88" cy="172" rx="13" ry="16" fill="#D99A5B"/><ellipse cx="112" cy="172" rx="13" ry="16" fill="#D99A5B"/>
<path d="M80 176 C74 150 80 122 98 116 C116 114 126 132 124 156 C122 172 112 180 100 180 C90 180 82 178 80 176Z" fill="#D99A5B"/>
<path d="M92 172 C88 152 92 130 101 126 C112 132 114 152 110 172Z" fill="#F3DDC0"/>
<g transform="rotate(7 100 62)">
<path d="M68 48 L66 12 L94 34Z" fill="#D99A5B"/><path d="M132 48 L136 12 L108 32Z" fill="#D99A5B"/>
<path d="M72 42 L72 22 L88 34Z" fill="#E7B9A6"/><path d="M128 42 L131 22 L114 32Z" fill="#E7B9A6"/>
<path d="M64 62 C64 40 80 28 100 28 C120 28 136 40 136 62 C136 84 120 96 100 96 C80 96 64 84 64 62Z" fill="#D99A5B"/>
<ellipse cx="100" cy="76" rx="15" ry="10" fill="#F3DDC0"/>
</g>
<path d="M88 130 C70 124 56 112 52 98 C50 90 58 86 62 92 C66 104 78 114 96 122Z" fill="#D99A5B"/>
<path d="M112 128 C130 122 144 110 148 96 C150 88 142 84 138 90 C134 102 122 112 104 120Z" fill="#D99A5B"/>
<ellipse cx="56" cy="92" rx="7.5" ry="6.5" fill="#F3DDC0"/><ellipse cx="144" cy="90" rx="7.5" ry="6.5" fill="#F3DDC0"/>
</g>
<g ${INK}>
<path d="M120 172 C150 170 160 142 148 126 C140 116 148 102 160 106" stroke="#A8642F" stroke-width="0.9" stroke-dasharray="1 0"/>
<path d="M141 164 l6 -3 M150 150 l6 -1 M146 134 l6 1 M152 112 l5 3" stroke="#A8642F" stroke-width="2"/>
<path d="M80 176 C74 150 80 122 96 116 M118 120 C124 132 126 150 122 166"/>
<path d="M76 186 C78 180 92 180 96 187 M104 187 C108 180 122 180 124 186 M84 185 l1 -3 M90 185 l1 -3 M110 185 l1 -3 M116 185 l1 -3" stroke-width="1"/>
<path d="M88 130 C70 124 56 112 52 98 M96 122 C78 114 66 104 62 92 M112 128 C130 122 144 110 148 96 M104 120 C122 112 134 102 138 90"/>
<path d="M50 88 l-2 -3 M55 86 l0 -4 M60 87 l2 -3 M139 85 l-2 -3 M144 84 l0 -4 M149 85 l2 -3" stroke-width="1"/>
<path d="M66 112 l4 -3 M74 118 l4 -3 M134 110 l-4 -3 M126 116 l-4 -3" stroke="#A8642F" stroke-width="1.8"/>
<g transform="rotate(7 100 62)">
<path d="M68 48 L66 12 L94 34 M132 48 L136 12 L108 32"/>
<path d="M64 62 C64 84 80 96 100 96 C120 96 136 84 136 62 C136 50 132 42 126 36 M74 36 C68 42 64 50 64 62"/>
<path d="M100 32 l0 9 M91 33 l1 8 M109 33 l-1 8" stroke="#A8642F" stroke-width="2"/>
<path d="M78 46 q6 -5 13 -2 M110 46 l13 2" stroke-width="1.5"/>
<path d="M94 80 C96 90 104 90 106 80 C102 82 98 82 94 80Z" fill="${MOUTH}"/>
<path d="M100 76 l0 4 M100 80 q-4 2 -7 0 M100 80 q4 2 7 0" stroke-width="1"/>
<path d="M82 76 l-22 -5 M82 80 l-22 3 M118 76 l22 -5 M118 80 l22 3" stroke-width="0.7"/>
</g>
${hatch(82, 160, 3, 3.5, 2, 8)}
<path d="M40 86 q-6 -6 -4 -14 M44 74 q-4 -6 0 -12 M160 84 q6 -6 4 -14 M156 72 q4 -6 0 -12" stroke-width="0.9"/>
</g>
<g class="detail"><g transform="rotate(7 100 62)">${ovalEye(86, 60, 4.2, 5.6)}${ovalEye(114, 60, 4.2, 5.6)}<path d="M96 72 L104 72 L100 76Z" fill="#C98A82"/><path d="M97 85 C99 88 101 88 103 85Z" fill="${TONGUE}"/>${blush(78, 74)}${blush(122, 74)}</g></g>`,

  // Fennel taps his chin with one paw, the other on his hip, one brow raised: he has a plan.
  fox: `
<g class="paint">${SHADOW}
<path d="M118 176 C150 186 184 170 184 140 C184 118 168 106 158 116 C170 132 164 158 132 164Z" fill="#C46A3A"/>
<path d="M176 116 C186 124 188 138 184 148 C174 142 168 128 170 118 C172 112 174 112 176 116Z" fill="#F3E6D0"/>
<path d="M84 189 L86 160 L96 160 L98 189Z" fill="#4A3A32"/><path d="M106 189 L106 162 L116 162 L118 189Z" fill="#4A3A32"/>
<ellipse cx="90" cy="189" rx="9" ry="3.5" fill="#4A3A32"/><ellipse cx="113" cy="189" rx="9" ry="3.5" fill="#4A3A32"/>
<path d="M78 170 C72 140 78 112 98 104 C118 100 130 116 130 140 C130 162 120 174 104 176 C92 178 82 176 78 170Z" fill="#C46A3A"/>
<path d="M88 168 C84 146 88 120 100 112 C110 126 110 152 104 170Z" fill="#F3E6D0"/>
<path d="M118 112 C132 118 140 130 134 140 C130 146 122 144 118 140 L120 134 C126 134 128 130 126 126 C122 120 116 118 112 116Z" fill="#C46A3A"/>
<path d="M92 112 C80 118 70 112 68 100 C66 92 70 86 76 86 C80 96 86 102 96 104Z" fill="#C46A3A"/>
<ellipse cx="73" cy="88" rx="6" ry="5" fill="#4A3A32"/>
<path d="M68 42 L62 8 L88 32Z" fill="#C46A3A"/><path d="M98 34 L108 4 L118 38Z" fill="#C46A3A"/>
<path d="M70 36 L66 16 L82 30Z" fill="#4A3A32"/><path d="M102 32 L108 12 L113 36Z" fill="#4A3A32"/>
<path d="M60 66 C56 46 72 32 92 32 C110 32 122 46 120 62 C118 74 108 82 94 86 C82 90 64 84 60 66Z" fill="#C46A3A"/>
<path d="M66 70 C54 72 42 74 33 79 C46 89 66 91 82 82 C78 74 72 70 66 70Z" fill="#F3E6D0"/>
<path d="M84 80 C94 84 106 80 114 72 C112 80 104 86 94 87 C90 87 86 85 84 80Z" fill="#F3E6D0"/>
</g>
<g ${INK}>
<path d="M118 176 C150 186 184 170 184 140 C184 118 168 106 158 116 C170 132 164 158 132 164"/>
<path d="M140 168 l6 -4 M152 162 l6 -4 M164 152 l6 -4 M172 138 l5 -2 M146 176 l4 -3" stroke-width="0.9"/>
<path d="M78 170 C72 140 78 112 92 106 M124 120 C130 132 130 152 124 166"/>
<path d="M92 128 l4 4 l-4 4 l4 4 l-4 4 l4 4" stroke="#C9B48F" stroke-width="1"/>
<path d="M92 112 C80 118 70 112 68 100 C66 92 70 86 76 86 M96 104 C86 102 80 96 78 90"/>
<path d="M118 112 C132 118 140 130 134 140 C130 146 122 144 118 140"/>
<path d="M68 42 L62 8 L88 32 M98 34 L108 4 L118 38"/>
<path d="M92 32 C110 32 122 46 120 62 C118 74 108 82 94 86 C84 88 72 86 64 80"/>
<path d="M60 66 C58 56 62 46 70 40"/>
<path d="M40 82 Q50 88 62 86" stroke-width="1.3"/>
<path d="M68 48 q8 -8 18 -4 M94 45 q6 -3 11 0" stroke-width="1.5"/>
<path d="M104 70 l3 -2 M108 64 l3 -2 M98 76 l3 -2" stroke-width="0.8"/>
${hatch(80, 150, 3, 3.5, 2, 9)}
<path d="M48 70 l-14 -8 M50 74 l-16 -2" stroke-width="0.7"/>
<path d="M56 98 q-6 -2 -10 2" stroke-width="0.9"/>
</g>
<g class="detail"><ellipse cx="77" cy="58" rx="3.6" ry="3.2" fill="#2A1E15"/><circle cx="78.4" cy="56.6" r="1.1" fill="#fff"/><ellipse cx="99" cy="55" rx="3" ry="3" fill="#2A1E15"/><circle cx="100" cy="54" r="0.9" fill="#fff"/><ellipse cx="33" cy="79" rx="3.6" ry="2.8" fill="#2A1E15"/>${blush(84, 70, 5, 2.6)}</g>`,

  // Hoot raises a wing to make a point — "Aha!" — spectacles on, beak open mid-lecture.
  owl: `
<g class="paint">${SHADOW}
<path d="M28 184 C80 180 130 182 178 184 L178 194 C130 192 80 192 28 194Z" fill="#7A6250"/>
<path d="M60 176 C50 140 58 98 100 92 C142 98 150 140 140 176 C126 188 74 188 60 176Z" fill="#A88560"/>
<path d="M76 172 C70 144 80 120 100 118 C120 120 130 144 124 172 C114 182 86 182 76 172Z" fill="#E3D2B4"/>
<path d="M64 118 C50 102 42 80 44 60 C46 52 54 52 56 60 C58 78 66 96 78 110Z" fill="#8C6A48"/>
<path d="M138 120 C152 136 150 158 134 168 C124 170 118 162 122 156 C132 150 136 138 134 126Z" fill="#8C6A48"/>
<path d="M66 56 L58 34 L84 50Z" fill="#A88560"/><path d="M134 56 L142 34 L116 50Z" fill="#A88560"/>
<path d="M62 96 C58 68 76 50 100 50 C124 50 142 68 138 96 C134 116 118 124 100 124 C82 124 66 116 62 96Z" fill="#A88560"/>
<ellipse cx="84" cy="88" rx="18" ry="17" fill="#E8D9BC"/><ellipse cx="116" cy="88" rx="18" ry="17" fill="#E8D9BC"/>
<path d="M95 100 L105 100 L100 108Z" fill="#D3A24F"/><path d="M96 109 L104 109 L100 114Z" fill="#B88A3A"/>
<ellipse cx="88" cy="185" rx="7" ry="4" fill="#D3A24F"/><ellipse cx="112" cy="185" rx="7" ry="4" fill="#D3A24F"/>
</g>
<g ${INK}>
<path d="M60 176 C50 140 58 98 72 70 M128 70 C142 98 150 140 140 176"/>
<path d="M62 96 C58 68 76 50 100 50 C124 50 142 68 138 96"/>
<path d="M66 56 L58 34 L84 50 M134 56 L142 34 L116 50"/>
<path d="M64 118 C50 102 42 80 44 60 C46 52 54 52 56 60 C58 78 66 96 78 110"/>
<path d="M50 64 l6 4 M48 74 l8 4 M50 86 l8 3 M56 98 l7 2" stroke-width="0.9"/>
<path d="M138 120 C152 136 150 158 134 168 M140 134 l-6 2 M142 146 l-7 1" stroke-width="1"/>
<path d="M84 136 l4 5 l4 -5 M104 136 l4 5 l4 -5 M92 150 l4 5 l4 -5 M80 162 l4 5 l4 -5 M108 162 l4 5 l4 -5" stroke="#8C6A48"/>
<path d="M72 128 q4 3 8 0 M120 128 q4 3 8 0 M68 146 q4 3 8 0 M124 146 q4 3 8 0" stroke-width="0.8"/>
<circle cx="84" cy="88" r="12" stroke="#5E4A3A" stroke-width="1.6"/><circle cx="116" cy="88" r="12" stroke="#5E4A3A" stroke-width="1.6"/>
<path d="M96 86 Q100 82 104 86 M72 86 l-8 -4 M128 86 l8 -4" stroke="#5E4A3A" stroke-width="1.6"/>
<path d="M70 70 q8 -8 18 -5 M112 66 q10 -4 18 4" stroke-width="1.6"/>
<path d="M95 100 L105 100 L100 108Z M96 109 L104 109 L100 114Z" stroke-width="1"/>
<path d="M82 184 l-2 4 M88 186 l0 4 M94 184 l2 4 M106 184 l-2 4 M112 186 l0 4 M118 184 l2 4" stroke-width="1"/>
<path d="M36 50 l-6 -6 M44 44 l-2 -8 M54 46 l2 -7" stroke-width="1.1"/>
<path d="M40 186 l20 -1 M110 188 l30 0 M150 186 l20 1" stroke="#5E4A3A" stroke-width="0.8"/>
</g>
<g class="detail">${eye(84, 89, 5.6)}${eye(116, 89, 5.6)}</g>`,

  // Ellie sits back and trumpets for joy: trunk curled high, one front foot waving.
  elephant: `
<g class="paint">${SHADOW}
<ellipse cx="68" cy="180" rx="23" ry="12" fill="#8C979A"/><ellipse cx="132" cy="180" rx="23" ry="12" fill="#9EA7AA"/>
<path d="M56 168 C48 136 66 108 100 106 C134 108 152 136 144 168 C138 186 62 186 56 168Z" fill="#9EA7AA"/>
<ellipse cx="100" cy="152" rx="22" ry="18" fill="#B4BBBC" opacity="0.6"/>
<path d="M68 60 C44 50 32 70 36 92 C40 110 60 112 74 98Z" fill="#929B9E"/>
<path d="M64 68 C50 64 44 76 46 90 C48 100 60 100 66 92Z" fill="#D9B2A6"/>
<path d="M132 60 C156 50 168 70 164 92 C160 110 140 112 126 98Z" fill="#929B9E"/>
<path d="M136 68 C150 64 156 76 154 90 C152 100 140 100 134 92Z" fill="#D9B2A6"/>
<circle cx="100" cy="76" r="34" fill="#9EA7AA"/>
<path d="M68 136 C52 132 36 124 26 112 C21 105 30 99 35 105 C42 114 56 122 74 124Z" fill="#9EA7AA"/>
<path d="M126 122 C136 132 134 148 120 154 C112 156 108 150 112 146 C120 142 122 134 118 128Z" fill="#9EA7AA"/>
<path d="M102 88 C102 104 108 116 122 118 C136 120 148 112 154 98 C157 90 166 90 164 98" fill="none" stroke="#9EA7AA" stroke-width="14" stroke-linecap="round"/>
</g>
<g ${INK}>
<path d="M56 168 C50 146 56 126 70 114 M130 114 C144 126 150 146 144 168"/>
<path d="M46 184 C46 172 60 168 74 172 M110 184 C110 172 124 168 140 172"/>
<path d="M50 186 q3 -4 6 0 M58 188 q3 -4 6 0 M140 186 q3 -4 6 0 M148 184 q3 -4 6 0" stroke-width="1"/>
<path d="M68 60 C44 50 32 70 36 92 C40 110 60 112 74 98 M132 60 C156 50 168 70 164 92 C160 110 140 112 126 98"/>
<path d="M44 78 q6 2 10 8 M156 78 q-6 2 -10 8" stroke="#B48C82" stroke-width="0.9"/>
<path d="M68 70 C70 52 84 42 100 42 C116 42 130 52 132 70"/>
<path d="M68 136 C52 132 36 124 26 112 C21 105 30 99 35 105 C42 114 56 122 74 124"/>
<path d="M24 106 q3 -3 6 -1 M27 111 q3 -2 6 0" stroke-width="0.9"/>
<path d="M126 122 C136 132 134 148 120 154 C112 156 108 150 112 146"/>
<path d="M95 88 C95 106 102 122 120 125 C138 128 154 118 160 102 M109 88 C109 100 114 110 122 111 C132 112 140 104 146 94 C150 86 158 82 166 86 C172 92 168 102 162 102"/>
<path d="M97 98 l8 -1 M99 108 l8 -3 M108 117 l4 -6 M128 118 l-2 -7 M140 112 l-4 -6 M150 102 l-6 -2" stroke-width="0.9"/>
<path d="M82 62 q5 -5 11 -2 M107 60 q6 -4 11 0" stroke-width="1.5"/>
<path d="M78 98 C80 108 92 110 96 100 C90 102 84 101 78 98Z" fill="${MOUTH}"/>
<path d="M172 72 q6 -4 10 0 M176 64 q8 -6 14 0 M178 56 q10 -8 16 -2" stroke-width="1"/>
<path d="M14 100 l-6 -4 M16 92 l-4 -6" stroke-width="1"/>
${hatch(62, 156, 4, 4, 3, 10)}${hatch(126, 158, 4, 4, 3, 10)}
<path d="M88 152 q12 4 24 0 M90 162 q10 3 20 0" stroke="#7F8B8E" stroke-width="0.8"/>
</g>
<g class="detail">${ovalEye(88, 72, 3.2, 4)}${ovalEye(112, 70, 3.2, 4)}${blush(76, 86)}${blush(124, 84)}<path d="M83 102 C86 106 90 106 93 102Z" fill="${TONGUE}"/></g>`,

  // Pebble mid-waddle: flippers flung out, one foot up, beak wide open laughing.
  penguin: `
<g class="paint">${SHADOW}
<g transform="rotate(-6 100 150)">
<ellipse cx="88" cy="187" rx="13" ry="5" fill="#D99447"/>
<ellipse cx="122" cy="176" rx="12" ry="5" fill="#D99447" transform="rotate(-25 122 176)"/>
<path d="M72 112 C54 108 38 116 30 128 C42 132 58 128 76 124Z" fill="#4E5B66"/>
<path d="M130 108 C146 96 158 86 166 74 C156 72 140 82 126 98Z" fill="#4E5B66"/>
<path d="M70 180 C56 150 58 104 80 80 C94 66 116 66 128 82 C146 106 146 150 132 180 C118 190 84 190 70 180Z" fill="#4E5B66"/>
<path d="M82 178 C72 150 76 118 92 104 C100 96 114 94 120 104 C132 130 130 160 120 178 C110 186 92 186 82 178Z" fill="#F2EFE6"/>
<path d="M112 84 L136 86 L114 92Z" fill="#D99447"/><path d="M114 94 L132 96 L114 99Z" fill="#B87A36"/>
</g>
</g>
<g ${INK}>
<g transform="rotate(-6 100 150)">
<path d="M70 180 C56 150 58 104 80 80 C94 66 116 66 128 82 C146 106 146 150 132 180"/>
<path d="M72 112 C54 108 38 116 30 128 C42 132 58 128 76 124 M130 108 C146 96 158 86 166 74 C156 72 140 82 126 98"/>
<path d="M40 124 l8 -2 M50 126 l8 -2 M146 88 l6 -6 M152 84 l6 -6" stroke-width="0.8"/>
<path d="M82 178 C72 150 76 118 92 104"/>
<path d="M112 84 L136 86 L114 92 M114 94 L132 96 L114 99"/>
<path d="M98 66 C96 58 100 54 104 56 M104 66 C106 60 112 58 114 62" stroke-width="1.1"/>
<path d="M90 76 q5 -4 10 -1" stroke-width="1.5"/>
${happyEye(98, 84, 5)}
<path d="M76 186 C80 182 94 182 100 188" stroke-width="1"/>
<path d="M66 120 l4 -2 M64 134 l4 -2 M66 148 l4 -2 M136 120 l-4 -2 M138 134 l-4 -2 M136 148 l-4 -2" stroke="#3A444C" stroke-width="0.9"/>
${hatch(90, 160, 4, 4, 2, 8)}
</g>
<path d="M14 120 l-8 -2 M16 132 l-8 2 M176 68 l6 -6 M180 76 l8 -2" stroke-width="1.1"/>
<path d="M136 168 q8 4 14 0 M140 176 q8 3 12 0" stroke-width="0.9" stroke-dasharray="2 3"/>
</g>
<g class="detail"><g transform="rotate(-6 100 150)">${blush(92, 96, 5, 2.6)}<path d="M116 92 L128 94 L116 95Z" fill="${TONGUE}"/></g></g>`,

  // Dot gives a mighty (tiny) "RAWR!": arms up, claws out, tail high, mouth wide.
  dino: `
<g class="paint">${SHADOW}
<path d="M76 168 C46 168 26 152 22 128 C34 142 54 152 74 150Z" fill="#8FA77A"/>
<path d="M30 136 L22 128 L34 126Z M44 150 L36 146 L46 140Z M58 158 L52 154 L62 150Z" fill="#C98F6E"/>
<path d="M80 56 L70 46 L82 44Z M72 78 L60 72 L72 68Z M66 104 L54 100 L64 94Z M64 130 L52 128 L62 120Z" fill="#C98F6E"/>
<ellipse cx="82" cy="186" rx="17" ry="7" fill="#7C9468"/><ellipse cx="122" cy="186" rx="17" ry="7" fill="#7C9468"/>
<ellipse cx="86" cy="172" rx="15" ry="16" fill="#8FA77A"/><ellipse cx="118" cy="172" rx="15" ry="16" fill="#8FA77A"/>
<path d="M68 172 C58 144 64 112 88 102 C110 96 132 108 136 132 C140 156 132 176 112 180 C96 184 76 182 68 172Z" fill="#8FA77A"/>
<path d="M90 176 C84 152 88 126 102 118 C118 124 124 150 118 174Z" fill="#DCD9B4"/>
<path d="M88 112 C76 104 70 92 72 82 C74 76 82 76 82 82 C83 92 88 100 96 106Z" fill="#8FA77A"/>
<path d="M126 112 C138 104 144 92 142 82 C140 76 132 76 132 82 C131 92 126 100 118 106Z" fill="#8FA77A"/>
<path d="M76 70 C72 46 90 30 112 30 C136 30 152 46 150 68 C148 88 132 98 110 98 C92 98 78 90 76 70Z" fill="#8FA77A"/>
<path d="M100 76 C106 94 132 96 142 76 C128 82 112 82 100 76Z" fill="${MOUTH}"/>
</g>
<g ${INK}>
<path d="M76 168 C46 168 26 152 22 128 C34 142 54 152 74 150"/>
<path d="M68 172 C58 144 64 112 82 104 M128 112 C136 126 138 156 128 172"/>
<path d="M66 186 C70 178 92 178 98 186 M106 186 C112 178 132 178 138 186"/>
<path d="M68 188 l-3 2 M74 189 l-2 3 M134 188 l3 2 M128 189 l2 3" stroke-width="1"/>
<path d="M88 112 C76 104 70 92 72 82 M96 106 C88 100 83 92 82 82 M126 112 C138 104 144 92 142 82 M118 106 C126 100 131 92 132 82"/>
<path d="M70 80 l-3 -5 M74 76 l-1 -6 M80 77 l1 -6 M134 77 l-1 -6 M140 76 l1 -6 M144 80 l3 -5" stroke-width="1.1"/>
<path d="M76 70 C72 46 90 30 112 30 C136 30 152 46 150 68 C148 84 138 94 124 97"/>
<path d="M100 76 C106 94 132 96 142 76 C128 82 112 82 100 76Z"/>
<path d="M106 79 l2 4 l2 -4 M116 81 l2 4 l2 -4 M126 81 l2 4 l2 -4 M134 79 l2 4 l2 -4" fill="#FFFFFF" stroke-width="0.8"/>
<path d="M94 50 l12 5 M126 54 l12 -5" stroke-width="1.7"/>
<path d="M96 138 l10 0 M96 150 l12 0 M98 162 l10 0" stroke="#B5B08A"/>
${hatch(72, 156, 3, 4, 2, 8)}
<path d="M154 50 q8 4 10 12 M160 40 q12 6 14 20 M166 30 q16 8 18 28" stroke-width="1"/>
</g>
<g class="detail">${ovalEye(104, 60, 3.6, 4.6)}${ovalEye(130, 58, 3.6, 4.6)}<g fill="#6E8560"><circle cx="88" cy="56" r="1.8"/><circle cx="84" cy="64" r="1.5"/><circle cx="92" cy="64" r="1.5"/></g><circle cx="146" cy="58" r="1.3" fill="#3E4A34"/><path d="M114 88 C118 92 126 92 130 88Z" fill="${TONGUE}"/></g>`,

  // Berry leaps for joy: arms flung up, one leg kicked, leafy cap askew.
  strawberry: `
<g class="paint">${SHADOW}
<g transform="rotate(-6 100 120)">
<path d="M100 166 C66 154 52 118 58 92 C64 68 136 68 142 92 C148 118 134 154 100 166Z" fill="#B9473F"/>
<path d="M70 94 C72 84 82 80 90 82 C82 90 78 102 76 116 C70 110 68 102 70 94Z" fill="#D9776A" opacity="0.8"/>
<path d="M118 150 C130 140 136 124 136 108 C142 124 136 144 120 156Z" fill="#8E3530" opacity="0.5"/>
<g transform="rotate(-14 100 70)"><path d="M100 76 C88 82 70 82 64 74 C76 66 90 68 100 72Z M100 76 C112 82 130 82 136 74 C124 66 110 68 100 72Z M100 74 C94 64 92 56 96 50 C104 56 106 64 100 74Z M100 74 C108 68 118 66 124 70 C118 76 108 78 100 74Z" fill="#6F8F4E"/></g>
</g>
<ellipse cx="80" cy="186" rx="9" ry="4.5" fill="#4F3A2A"/><ellipse cx="128" cy="172" rx="9" ry="4.5" fill="#4F3A2A" transform="rotate(-30 128 172)"/>
<circle cx="40" cy="58" r="5.5" fill="#F4EFE4"/><circle cx="160" cy="54" r="5.5" fill="#F4EFE4"/>
</g>
<g ${INK}>
<g transform="rotate(-6 100 120)">
<path d="M100 166 C66 154 52 118 58 92 C62 80 70 76 80 74 M120 74 C130 76 138 80 142 92 C148 118 134 154 100 166"/>
<path d="M90 120 q-6 4 -8 10 M128 112 q4 6 2 12" stroke-width="0.8"/>
<g transform="rotate(-14 100 70)"><path d="M100 66 C100 56 104 50 110 46" stroke="#5E7A40" stroke-width="2.4"/><path d="M76 74 l10 2 M124 74 l-10 2 M98 60 l1 8" stroke="#5E7A40" stroke-width="0.9"/></g>
<path d="M88 104 q5 -5 11 -2 M106 101 q6 -3 11 1" stroke-width="1.5"/>
<path d="M92 124 C96 136 110 136 114 122 C106 126 98 126 92 124Z" fill="${MOUTH}"/>
<path d="M98 150 l2 4 M110 146 l2 4" stroke-width="0.8"/>
</g>
<path d="M84 158 C82 170 82 178 80 184 M114 156 C120 162 126 166 130 170" stroke-width="2.2"/>
<path d="M62 106 C52 94 46 78 42 62 M138 102 C148 90 154 74 158 58" stroke-width="2.2"/>
<path d="M36 56 l-2 -4 M40 52 l0 -5 M44 54 l2 -4 M156 52 l-2 -4 M160 48 l0 -5 M164 50 l2 -4" stroke-width="1"/>
<path d="M60 182 q8 -4 14 0 M136 182 q8 -4 14 0" stroke-width="0.9" stroke-dasharray="2 3"/>
<path d="M28 40 l-6 -4 M32 32 l-2 -7 M170 36 l6 -4 M166 28 l2 -7" stroke-width="1.1"/>
</g>
<g class="detail"><g transform="rotate(-6 100 120)">${ovalEye(92, 112, 3, 3.8)}${ovalEye(112, 110, 3, 3.8)}<path d="M98 128 C101 131 105 131 108 128Z" fill="${TONGUE}"/>${blush(82, 120, 5, 2.6)}${blush(122, 118, 5, 2.6)}<g fill="#E8CF7E"><ellipse cx="72" cy="100" rx="1.6" ry="2.6"/><ellipse cx="128" cy="98" rx="1.6" ry="2.6"/><ellipse cx="68" cy="128" rx="1.6" ry="2.6"/><ellipse cx="132" cy="130" rx="1.6" ry="2.6"/><ellipse cx="82" cy="148" rx="1.6" ry="2.6"/><ellipse cx="118" cy="148" rx="1.6" ry="2.6"/><ellipse cx="100" cy="156" rx="1.6" ry="2.6"/><ellipse cx="86" cy="88" rx="1.6" ry="2.6"/><ellipse cx="114" cy="88" rx="1.6" ry="2.6"/><ellipse cx="74" cy="138" rx="1.6" ry="2.6"/><ellipse cx="126" cy="140" rx="1.6" ry="2.6"/></g></g></g>`,

  // Sprinkles strikes a party pose: one arm up pointing, one hand on hip, a leg kicked out.
  cupcake: `
<g class="paint">${SHADOW}
<path d="M54 112 L146 112 L134 172 L66 172Z" fill="#C9D6D8"/>
<path d="M58 116 L70 168 L78 168 L68 116Z M90 116 L94 168 L102 168 L100 116Z M122 116 L114 168 L122 168 L132 116Z" fill="#B3C3C6" opacity="0.7"/>
<path d="M50 114 C40 108 46 92 60 92 C60 76 80 68 92 76 C98 62 118 64 120 78 C132 72 150 82 146 96 C156 100 156 114 148 116 C120 122 80 122 50 114Z" fill="#F1E2DA"/>
<path d="M66 90 C78 82 104 80 124 90 C112 98 84 98 66 90Z" fill="#E7C9C0"/>
<path d="M80 78 C88 70 108 70 116 78 C108 84 88 84 80 78Z" fill="#EBD3CB"/>
<circle cx="104" cy="56" r="10" fill="#B2443A"/>
<ellipse cx="80" cy="187" rx="9" ry="4" fill="#4F3A2A"/><ellipse cx="146" cy="176" rx="9" ry="4" fill="#4F3A2A" transform="rotate(-20 146 176)"/>
<circle cx="36" cy="46" r="5" fill="#F4EFE4"/>
</g>
<g ${INK}>
<path d="M54 112 L66 172 L134 172 L146 112"/>
<path d="M66 116 L76 170 M82 116 L88 170 M100 116 L100 170 M118 116 L112 170 M134 116 L124 170" stroke="#8FA3A8" stroke-width="0.9"/>
<path d="M50 114 C40 108 46 92 60 92 C60 76 80 68 92 76 C98 62 118 64 120 78 C132 72 150 82 146 96 C156 100 156 114 148 116"/>
<path d="M62 104 q14 6 30 0 M100 102 q16 6 32 -2 M78 86 q12 4 24 0" stroke="#C9A79C" stroke-width="0.9"/>
<path d="M106 46 C108 38 114 34 120 32" stroke="#5E7A40" stroke-width="1.8"/>
<path d="M84 172 C82 178 81 182 80 186 M118 172 C128 174 138 174 146 176" stroke-width="2.2"/>
<path d="M58 124 C46 112 40 84 36 50 M142 128 C156 130 162 136 156 146 C152 150 146 148 144 144" stroke-width="2.2"/>
<path d="M32 44 l2 -6 M38 42 l0 -6" stroke-width="1"/>
<path d="M84 136 q4 -3 8 0 M106 136 q4 -3 8 0" stroke-width="1.6"/>
<path d="M88 146 Q99 158 112 146" stroke-width="1.6"/>
<path d="M22 30 l-4 -6 M30 26 l0 -7 M44 30 l4 -6" stroke-width="1.1"/>
<path d="M160 168 q6 -2 10 2 M158 178 q6 0 10 4" stroke-width="0.9" stroke-dasharray="2 3"/>
</g>
<g class="detail">${blush(78, 146)}${blush(122, 146)}<circle cx="101" cy="52" r="2.4" fill="#fff" opacity="0.6"/><g stroke-width="2.5" stroke-linecap="round"><path d="M70 100 l5 -2" stroke="#8FA7B5"/><path d="M96 92 l5 2" stroke="#D3A24F"/><path d="M122 100 l4 3" stroke="#8FA77A"/><path d="M134 92 l4 -3" stroke="#A99BB5"/><path d="M86 82 l3 3" stroke="#B2443A"/><path d="M110 76 l4 -1" stroke="#8FA7B5"/></g></g>`,

  // Avo lounges: one arm behind his head, the other giving a lazy wave, legs crossed, eyes half-closed.
  avocado: `
<g class="paint">${SHADOW}
<path d="M100 22 C130 22 140 56 148 84 C158 110 170 130 164 156 C156 182 130 190 100 190 C70 190 44 182 36 156 C30 130 42 110 52 84 C60 56 70 22 100 22Z" fill="#5E6E3F"/>
<path d="M100 34 C122 34 130 62 136 86 C144 110 156 128 150 152 C144 172 124 178 100 178 C76 178 56 172 50 152 C44 128 56 110 64 86 C70 62 78 34 100 34Z" fill="#D9DDA0"/>
<path d="M100 40 C116 40 124 62 128 82 C112 76 90 76 72 82 C76 62 84 40 100 40Z" fill="#E6E8BC"/>
<circle cx="100" cy="146" r="25" fill="#8C5E3C"/>
<ellipse cx="92" cy="138" rx="7" ry="5" fill="#B08462"/>
<ellipse cx="74" cy="196" rx="9" ry="3.5" fill="#4F3A2A"/><ellipse cx="128" cy="196" rx="9" ry="3.5" fill="#4F3A2A"/>
</g>
<g ${INK}>
<path d="M100 22 C130 22 140 56 148 84 C158 110 170 130 164 156 C156 182 130 190 100 190 C70 190 44 182 36 156 C30 130 42 110 52 84 C60 56 70 22 100 22Z"/>
<path d="M50 152 C56 172 76 178 100 178 C124 178 144 172 150 152" stroke="#9AA36A"/>
<path d="M58 96 l4 2 M54 112 l4 1 M146 100 l-4 2 M150 116 l-4 1 M44 140 l4 0 M156 138 l-4 0" stroke="#3E4A2A" stroke-width="0.8"/>
<circle cx="100" cy="146" r="25"/>
<path d="M84 160 q8 6 18 4 M112 158 q4 -4 4 -8" stroke="#6E4A2E" stroke-width="0.9"/>
<path d="M50 96 C36 84 34 64 46 52 C54 46 62 50 60 58" stroke-width="2.2"/>
<path d="M150 112 C164 104 172 90 170 74 M166 70 l2 -6 M170 72 l5 -4 M171 76 l6 -1" stroke-width="2.2"/>
<path d="M80 186 C78 190 76 192 74 194 M80 186 C96 182 112 186 128 194" stroke-width="2.2"/>
<path d="M82 92 q6 -2 12 1 M108 93 q6 -3 12 -1" stroke-width="1.6"/>
<path d="M82 98 Q88 95 94 98 M108 98 Q114 95 120 98" stroke-width="1.6"/>
<path d="M92 112 Q102 120 112 110" stroke-width="1.5"/>
<path d="M178 60 q4 -4 8 0 M180 52 q6 -6 12 0" stroke-width="0.9"/>
</g>
<g class="detail"><path d="M84 98 Q88 102 92 98Z M110 98 Q114 102 118 98Z" fill="#2A1E15"/>${blush(78, 106)}${blush(124, 106)}</g>`,

  // Bao stands tall and brave: fists on hips, feet planted, brows set, steam curling up.
  dumpling: `
<g class="paint">${SHADOW}
<path d="M28 172 C22 116 62 74 100 72 C138 74 178 116 172 172 C150 188 50 188 28 172Z" fill="#F4EEE2"/>
<path d="M32 166 C44 178 154 180 168 166 C170 174 160 182 100 184 C44 182 32 176 32 166Z" fill="#E2D6C2"/>
<path d="M90 74 C92 62 108 62 110 74 C104 78 96 78 90 74Z" fill="#EDE4D3"/>
<ellipse cx="78" cy="189" rx="10" ry="4" fill="#4F3A2A"/><ellipse cx="122" cy="189" rx="10" ry="4" fill="#4F3A2A"/>
<circle cx="24" cy="136" r="6" fill="#F4EEE2"/><circle cx="176" cy="136" r="6" fill="#F4EEE2"/>
</g>
<g ${INK}>
<path d="M28 172 C22 116 62 74 100 72 C138 74 178 116 172 172 C150 188 50 188 28 172Z"/>
<path d="M100 76 C86 84 70 96 62 108 M100 76 C92 88 86 100 84 110 M100 76 C108 88 114 100 116 110 M100 76 C114 84 130 96 138 108" stroke="#C9B9A2"/>
<path d="M90 74 C92 62 108 62 110 74"/>
<path d="M96 56 C90 48 102 42 96 32 M106 54 C112 46 102 38 110 28" stroke="#B9B2A8" stroke-width="1.1"/>
<path d="M36 140 C30 144 26 140 24 136 C26 130 32 130 36 134 M164 140 C170 144 174 140 176 136 C174 130 168 130 164 134" stroke-width="1.6"/>
<path d="M84 180 C82 184 80 186 78 188 M116 180 C118 184 120 186 122 188" stroke-width="2.2"/>
<path d="M74 118 l14 4 M126 118 l-14 4" stroke-width="2"/>
<path d="M88 144 C94 150 106 150 112 142" stroke-width="1.6"/>
${hatch(44, 160, 5, 4, 2, 6)}${hatch(140, 160, 5, 4, -2, 6)}
</g>
<g class="detail">${eye(84, 128, 3.4)}${eye(116, 128, 3.4)}${blush(70, 138, 7, 3.5)}${blush(130, 138, 7, 3.5)}</g>`,

  // Puff throws wispy arms out for a hug, eyes closed in bliss, a happy drizzle beneath.
  cloud: `
<g class="paint">
<path d="M46 150 C22 150 18 116 42 110 C36 82 70 68 86 84 C92 54 136 50 146 82 C172 76 188 106 168 122 C186 134 176 156 154 152Z" fill="#EEF0EE"/>
<path d="M44 146 C70 156 130 156 156 148 C150 156 120 160 100 160 C80 160 56 158 44 146Z" fill="#C7D0D4"/>
<path d="M30 124 C20 118 10 108 6 96 C14 98 24 108 32 116Z" fill="#EEF0EE"/>
<path d="M172 124 C182 118 190 108 194 96 C186 98 176 108 168 116Z" fill="#EEF0EE"/>
</g>
<g ${INK}>
<path d="M46 150 C22 150 18 116 42 110 C36 82 70 68 86 84 C92 54 136 50 146 82 C172 76 188 106 168 122 C186 134 176 156 154 152 C120 158 80 158 46 150Z" stroke="#7F8E96"/>
<path d="M30 124 C20 118 10 108 6 96 C14 98 24 108 32 116 M172 124 C182 118 190 108 194 96 C186 98 176 108 168 116" stroke="#7F8E96"/>
<path d="M60 108 q8 -6 16 0 M110 74 q10 -6 20 0 M140 104 q8 -6 16 0" stroke="#AFBCC2" stroke-width="0.9"/>
<path d="M70 168 l-3 8 M100 172 l-3 8 M130 168 l-3 8 M86 182 l-2 6 M116 184 l-2 6" stroke="#8FA7B5" stroke-width="1.6"/>
${happyEye(86, 114, 6)}${happyEye(114, 114, 6)}
<path d="M80 102 q6 -3 12 0 M108 102 q6 -3 12 0" stroke-width="1.3"/>
<path d="M92 126 C94 136 106 136 108 126 C102 128 98 128 92 126Z" fill="${MOUTH}" stroke="#5A6870"/>
<path d="M2 88 l-2 -6 M200 88 l2 -6" stroke-width="1"/>
</g>
<g class="detail">${blush(72, 124)}${blush(128, 124)}<path d="M97 131 C99 133 101 133 103 131Z" fill="${TONGUE}"/></g>`,

  // Twinkle winks and waves one point like a little hand, scattering sparkles.
  star: `
<g class="paint">
<circle cx="100" cy="108" r="88" fill="#F3E3B0" opacity="0.45"/>
<g transform="rotate(-10 100 108)">
<path d="M100 26 C106 26 108 34 112 46 L124 76 L156 78 C168 79 172 86 164 94 L140 116 L148 148 C150 160 144 164 134 158 L100 138 L66 158 C56 164 50 160 52 148 L60 116 L36 94 C28 86 32 79 44 78 L76 76 L88 46 C92 34 94 26 100 26Z" fill="#E8C766"/>
<path d="M100 40 L110 70 L90 70Z" fill="#F4DE98" opacity="0.8"/>
<path d="M140 116 L148 148 C150 160 144 164 134 158 L100 138 L118 120Z" fill="#D6AF4C" opacity="0.5"/>
</g>
</g>
<g ${INK}>
<g transform="rotate(-10 100 108)">
<path d="M100 26 C106 26 108 34 112 46 L124 76 L156 78 C168 79 172 86 164 94 L140 116 L148 148 C150 160 144 164 134 158 L100 138 L66 158 C56 164 50 160 52 148 L60 116 L36 94 C28 86 32 79 44 78 L76 76 L88 46 C92 34 94 26 100 26Z" stroke="#9E7E2E"/>
<path d="M100 44 l0 8 M150 84 l-6 2 M52 84 l6 2 M136 146 l-4 -6 M64 146 l4 -6" stroke="#B89A48" stroke-width="0.9"/>
<path d="M82 96 q5 -4 10 -1 M106 92 q6 -3 11 1" stroke-width="1.5"/>
${happyEye(112, 104, 5)}
<path d="M90 116 C94 126 108 126 112 114 C104 118 96 118 90 116Z" fill="${MOUTH}"/>
</g>
<path d="M22 34 l8 8 M30 34 l-8 8 M168 28 l6 6 M174 28 l-6 6 M176 168 l5 5 M181 168 l-5 5 M20 150 l4 4 M24 150 l-4 4" stroke="#B89A48"/>
<path d="M172 82 q8 -6 10 -16 M178 92 q12 -4 14 -16" stroke-width="1"/>
</g>
<g class="detail"><g transform="rotate(-10 100 108)">${eye(88, 104, 3.4)}${blush(80, 114, 5, 2.6)}${blush(120, 112, 5, 2.6)}<path d="M96 120 C99 123 103 123 106 120Z" fill="${TONGUE}"/></g><circle cx="186" cy="118" r="2" fill="#E8C766"/><circle cx="12" cy="100" r="2" fill="#E8C766"/></g>`,

  // Tilly puts a hand on her hip and points her spout, lid tipped at a jaunty angle.
  teapot: `
<g class="paint">${SHADOW}
<path d="M44 128 C20 122 18 156 42 160 L46 152 C32 148 32 134 46 138Z" fill="#F2EEE4"/>
<path d="M148 146 C164 140 168 118 182 108 C186 112 182 120 178 124 C172 140 166 160 146 166Z" fill="#F2EEE4"/>
<ellipse cx="98" cy="138" rx="58" ry="48" fill="#F2EEE4"/>
<path d="M50 160 C70 180 126 180 146 160 C140 178 122 186 98 186 C74 186 56 178 50 160Z" fill="#DCD6C8"/>
<g transform="rotate(-12 98 92)">
<path d="M58 98 C62 74 134 74 138 98 C120 104 76 104 58 98Z" fill="#F2EEE4"/>
<circle cx="98" cy="72" r="8" fill="#6F8FAF"/>
<path d="M58 98 C76 104 120 104 138 98 L136 104 C118 110 78 110 60 104Z" fill="#6F8FAF"/>
</g>
<ellipse cx="80" cy="190" rx="9" ry="3.5" fill="#6F8FAF"/><ellipse cx="118" cy="190" rx="9" ry="3.5" fill="#6F8FAF"/>
</g>
<g ${INK}>
<ellipse cx="98" cy="138" rx="58" ry="48" stroke="#5E6E86"/>
<path d="M44 128 C20 122 18 156 42 160 M148 146 C164 140 168 118 182 108 C186 112 182 120 178 124 C172 140 166 160 146 166" stroke="#5E6E86"/>
<g transform="rotate(-12 98 92)"><path d="M58 98 C62 74 134 74 138 98" stroke="#5E6E86"/><path d="M80 84 q6 -3 12 0" stroke="#5E6E86" stroke-width="0.8"/></g>
<path d="M84 184 L82 189 M114 184 L116 189" stroke-width="2"/>
<path d="M184 104 l6 -6 M188 112 l8 -2" stroke-width="1"/>
<path d="M78 128 q6 -5 12 -2 M104 124 l12 -3" stroke-width="1.5"/>
<path d="M90 152 Q98 158 106 150" stroke-width="1.5"/>
${hatch(60, 162, 5, 4, 2, 6)}
<path d="M132 176 q6 -2 10 -6" stroke="#5E6E86" stroke-width="0.8"/>
</g>
<g class="detail">${ovalEye(86, 138, 3, 3.8)}${ovalEye(110, 136, 3, 3.8)}<g fill="none" stroke="#6F8FAF" stroke-width="1.6" stroke-linecap="round"><path d="M56 124 c4 -8 12 -8 14 0 c-6 2 -10 2 -14 0Z"/><path d="M128 120 c4 -8 12 -8 14 0 c-6 2 -10 2 -14 0Z"/><path d="M64 160 q8 -6 16 0 M116 162 q8 -6 16 0"/><path d="M70 120 l6 4 M136 124 l-6 4"/><path d="M60 150 c3 -5 8 -5 10 0 M132 150 c3 -5 8 -5 10 0"/></g>${blush(76, 148)}${blush(120, 146)}</g>`,

  // Bolt waves hello with both arms, one foot lifted, antenna fizzing.
  robot: `
<g class="paint">${SHADOW}
<rect x="78" y="166" width="18" height="22" rx="3" fill="#6F9A9A"/>
<rect x="106" y="160" width="18" height="20" rx="3" fill="#6F9A9A" transform="rotate(-18 115 170)"/>
<path d="M58 132 C46 124 38 112 36 98 L46 94 C48 106 54 116 64 124Z" fill="#6F9A9A"/>
<path d="M142 132 C156 134 166 130 172 122 L178 130 C170 140 156 144 142 142Z" fill="#6F9A9A"/>
<circle cx="40" cy="92" r="7" fill="#C9A24F"/><circle cx="178" cy="124" r="7" fill="#C9A24F"/>
<rect x="58" y="120" width="84" height="54" rx="8" fill="#6F9A9A"/>
<rect x="72" y="130" width="56" height="34" rx="4" fill="#E9DFC6"/>
<path d="M142 150 L160 150 L160 144 L168 144 L168 162 L160 162 L160 156 L142 156Z" fill="#C9A24F"/>
<g transform="rotate(-6 100 86)">
<rect x="56" y="52" width="88" height="68" rx="10" fill="#6F9A9A"/>
<rect x="68" y="64" width="64" height="42" rx="6" fill="#E9DFC6"/>
<path d="M100 52 L100 34" stroke="#4F3A2A" stroke-width="2"/>
<circle cx="100" cy="30" r="6" fill="#B2443A"/>
</g>
</g>
<g ${INK}>
<rect x="58" y="120" width="84" height="54" rx="8"/>
<path d="M58 132 C46 124 38 112 36 98 M64 124 C54 116 48 106 46 94 M142 132 C156 134 166 130 172 122 M142 142 C156 144 170 140 178 130"/>
<path d="M44 128 l4 -4 M40 116 l4 -3 M156 138 l2 -5 M164 136 l2 -5" stroke-width="0.9"/>
<path d="M76 150 L124 150 M76 156 L110 156" stroke="#B8A888"/>
<g transform="rotate(-6 100 86)">
<rect x="56" y="52" width="88" height="68" rx="10"/>
<path d="M80 74 q6 -4 12 0 M108 74 q6 -4 12 0" stroke-width="1.5"/>
<path d="M86 94 Q100 104 114 94" stroke-width="1.6"/>
<path d="M88 98 l0 3 M94 100 l0 3 M100 101 l0 3 M106 100 l0 3 M112 98 l0 3" stroke-width="0.8"/>
<path d="M90 22 l-4 -6 M100 18 l0 -8 M110 22 l4 -6" stroke="#B2443A" stroke-width="1.2"/>
</g>
<path d="M24 86 l-6 -4 M26 78 l-4 -7 M186 118 l6 -4 M190 128 l8 -1" stroke-width="1.1"/>
${hatch(62, 166, 5, 4, 2, 6)}
</g>
<g class="detail"><g transform="rotate(-6 100 86)">${eye(86, 82, 5.6)}${eye(114, 82, 5.6)}<g fill="#4F3A2A"><circle cx="62" cy="58" r="1.6"/><circle cx="138" cy="58" r="1.6"/><circle cx="62" cy="114" r="1.6"/><circle cx="138" cy="114" r="1.6"/></g>${blush(74, 96, 5, 2.6)}${blush(126, 96, 5, 2.6)}</g><g fill="#4F3A2A"><circle cx="64" cy="126" r="1.6"/><circle cx="136" cy="126" r="1.6"/><circle cx="64" cy="168" r="1.6"/><circle cx="136" cy="168" r="1.6"/></g><path d="M100 147 C96 142 92 140 94 137 C96 135 99 136 100 138 C101 136 104 135 106 137 C108 140 104 142 100 147Z" fill="#B2443A"/></g>`,
};
