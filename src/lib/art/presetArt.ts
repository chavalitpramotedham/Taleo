// Reference paintings ("model sheets") for the preset characters, drawn on a
// 200x200 canvas with feet/base at y≈190. They use exactly the same layered
// markup Claude uses when it paints story pages:
//   <g class="paint">  watercolour fills  (rendered with the tl-paint filter)
//   <g class="ink">    fine sepia linework (rendered with the tl-ink filter)
//   <g class="detail"> crisp eyes / tiny highlights (no filter)
// They are shown in the character picker and sent to Claude as visual
// references so each character stays recognisable from page to page.

const INK = `class="ink" fill="none" stroke="#4F3A2A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"`;
const SHADOW = `<ellipse cx="100" cy="191" rx="62" ry="6" fill="#CFC6AC" opacity="0.6"/>`;
const eye = (x: number, y: number, r = 3.3) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#2A1E15"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.3}" r="${(r * 0.3).toFixed(1)}" fill="#FFFFFF"/>`;

export const PRESET_ART: Record<string, string> = {
  bunny: `
<g class="paint">${SHADOW}
<path d="M62 186 C46 170 44 136 62 116 C78 98 108 94 128 104 C144 112 150 132 148 152 C146 172 136 186 120 188Z" fill="#A98463"/>
<path d="M118 112 C134 118 142 140 136 162 C132 176 122 184 112 186 C116 160 114 132 118 112Z" fill="#E9DCC5"/>
<path d="M74 150 C70 168 76 182 92 188 L62 188 C54 176 56 160 74 150Z" fill="#8C6B4E" opacity="0.5"/>
<path d="M126 66 C116 40 112 14 120 10 C128 8 134 34 136 60Z" fill="#9C7756"/>
<path d="M112 92 C110 72 124 58 142 58 C160 58 172 72 170 90 C168 106 154 114 138 114 C124 114 114 106 112 92Z" fill="#A98463"/>
<path d="M138 60 C138 34 146 10 156 12 C164 16 156 44 148 64Z" fill="#A98463"/>
<path d="M142 54 C143 36 148 22 153 22 C156 26 152 42 146 58Z" fill="#D9B8A0"/>
<ellipse cx="160" cy="98" rx="10" ry="8" fill="#E9DCC5"/>
<circle cx="54" cy="168" r="11" fill="#F4EFE4"/>
<path d="M70 188 C70 180 100 178 112 188Z" fill="#9C7756"/>
<ellipse cx="128" cy="186" rx="11" ry="5" fill="#A98463"/>
</g>
<g ${INK}>
<path d="M62 186 C46 170 44 136 62 116 C78 98 108 94 120 98"/>
<path d="M136 120 C146 136 148 160 140 176"/>
<path d="M112 92 C110 72 124 58 142 58 C160 58 172 72 170 90 C168 104 156 112 142 114"/>
<path d="M126 66 C116 40 112 14 120 10 C128 8 134 34 136 60"/>
<path d="M138 60 C138 34 146 10 156 12 C164 16 156 44 148 64"/>
<path d="M70 188 C70 180 100 178 112 188 M118 188 C120 182 134 182 138 188"/>
<path d="M80 126 l4 -5 M92 120 l4 -5 M70 140 l4 -4 M120 70 l3 -4" stroke-width="0.9"/>
<path d="M168 96 l14 -3 M168 99 l14 4 M166 101 l11 8" stroke-width="0.8"/>
<path d="M163 100 C166 103 169 103 171 100"/>
</g>
<g class="detail">${eye(152, 84)}<ellipse cx="168" cy="94" rx="2.6" ry="2" fill="#8E5A4A"/></g>`,

  bear: `
<g class="paint">${SHADOW}
<path d="M58 182 C44 160 48 124 74 112 C96 102 126 104 140 122 C156 142 154 172 140 184 C120 194 76 194 58 182Z" fill="#8E6A4C"/>
<path d="M80 178 C74 156 84 134 102 132 C120 132 128 152 124 172 C120 186 90 190 80 178Z" fill="#C9AC88"/>
<circle cx="70" cy="54" r="13" fill="#8E6A4C"/><circle cx="70" cy="54" r="6" fill="#C9AC88"/>
<circle cx="132" cy="52" r="13" fill="#8E6A4C"/><circle cx="132" cy="52" r="6" fill="#C9AC88"/>
<path d="M64 92 C60 66 78 46 102 46 C128 46 144 64 140 90 C138 108 120 120 100 120 C80 120 66 108 64 92Z" fill="#8E6A4C"/>
<ellipse cx="102" cy="98" rx="18" ry="13" fill="#C9AC88"/>
<ellipse cx="70" cy="150" rx="11" ry="20" transform="rotate(20 70 150)" fill="#7A5A40"/>
<ellipse cx="134" cy="150" rx="11" ry="20" transform="rotate(-20 134 150)" fill="#7A5A40"/>
<ellipse cx="72" cy="184" rx="18" ry="9" fill="#7A5A40"/><ellipse cx="130" cy="184" rx="18" ry="9" fill="#7A5A40"/>
<ellipse cx="72" cy="184" rx="8" ry="4.5" fill="#C9AC88"/><ellipse cx="130" cy="184" rx="8" ry="4.5" fill="#C9AC88"/>
</g>
<g ${INK}>
<path d="M58 182 C44 160 48 124 74 112 M128 110 C150 126 156 164 140 184"/>
<path d="M64 92 C60 66 78 46 102 46 C128 46 144 64 140 90 C138 108 120 120 100 120 C80 120 66 108 64 92"/>
<path d="M58 50 C60 40 76 38 82 46 M120 46 C126 38 142 40 144 50"/>
<path d="M96 106 Q102 111 108 106"/>
<path d="M60 172 C70 168 84 172 90 182 M112 182 C118 172 134 168 146 174"/>
<path d="M84 64 l3 -4 M116 62 l3 -4 M92 136 l2 -4" stroke-width="0.9"/>
</g>
<g class="detail">${eye(88, 82)}${eye(118, 82)}<ellipse cx="102" cy="93" rx="5" ry="3.6" fill="#3A2A20"/></g>`,

  kitty: `
<g class="paint">${SHADOW}
<path d="M134 180 C156 184 168 174 166 160 C165 152 172 150 176 158 C182 176 162 194 132 190Z" fill="#D99A5B"/>
<path d="M66 184 C56 160 62 128 84 118 C100 112 120 116 132 128 C146 146 146 172 136 186Z" fill="#D99A5B"/>
<path d="M88 182 C84 160 90 136 104 132 C118 136 122 160 116 182Z" fill="#F3DDC0"/>
<path d="M66 70 L64 34 L92 54Z" fill="#D99A5B"/><path d="M134 70 L136 34 L108 54Z" fill="#D99A5B"/>
<path d="M70 64 L70 44 L86 56Z" fill="#E7B9A6"/><path d="M130 64 L130 44 L114 56Z" fill="#E7B9A6"/>
<path d="M62 86 C62 64 80 52 100 52 C120 52 138 64 138 86 C138 106 120 118 100 118 C80 118 62 106 62 86Z" fill="#D99A5B"/>
<ellipse cx="100" cy="100" rx="15" ry="9" fill="#F3DDC0"/>
<ellipse cx="90" cy="187" rx="10" ry="5.5" fill="#F3DDC0"/><ellipse cx="112" cy="187" rx="10" ry="5.5" fill="#F3DDC0"/>
</g>
<g ${INK}>
<path d="M66 184 C56 160 62 128 84 118 M120 120 C140 134 146 164 136 186"/>
<path d="M134 180 C156 184 168 174 166 160 C165 152 172 150 176 158 C182 176 162 194 132 190"/>
<path d="M66 70 L64 34 L92 54 M134 70 L136 34 L108 54"/>
<path d="M62 86 C62 104 80 118 100 118 C120 118 138 104 138 86"/>
<path d="M100 56 l0 10 M90 58 l2 9 M110 58 l-2 9" stroke="#A8642F" stroke-width="2"/>
<path d="M70 140 q6 2 10 -2 M68 156 q6 2 10 -2 M126 140 q-6 2 -10 -2 M160 166 l6 -4 M168 176 l6 -2" stroke="#A8642F" stroke-width="1.8"/>
<path d="M100 101 q-4 5 -9 3 M100 101 q4 5 9 3"/>
<path d="M80 100 l-22 -4 M80 104 l-22 4 M120 100 l22 -4 M120 104 l22 4" stroke-width="0.7"/>
</g>
<g class="detail"><ellipse cx="86" cy="84" rx="4.2" ry="4.8" fill="#2A1E15"/><circle cx="87.5" cy="82.5" r="1.3" fill="#fff"/><ellipse cx="114" cy="84" rx="4.2" ry="4.8" fill="#2A1E15"/><circle cx="115.5" cy="82.5" r="1.3" fill="#fff"/><path d="M96 95 L104 95 L100 99Z" fill="#C98A82"/></g>`,

  fox: `
<g class="paint">${SHADOW}
<path d="M120 184 C150 192 186 180 188 150 C190 126 172 118 166 132 C176 146 166 170 130 172Z" fill="#C46A3A"/>
<path d="M180 128 C188 136 190 148 186 156 C176 150 170 138 172 128 C174 124 178 124 180 128Z" fill="#F3E6D0"/>
<path d="M70 186 C60 160 64 128 86 114 C104 104 124 112 132 132 C140 152 136 176 124 188Z" fill="#C46A3A"/>
<path d="M80 184 C72 160 76 134 92 124 C104 140 104 166 98 186Z" fill="#F3E6D0"/>
<path d="M84 188 L86 158 L96 158 L96 189Z" fill="#4A3A32"/><path d="M108 189 L108 162 L118 162 L118 189Z" fill="#4A3A32"/>
<path d="M66 66 L60 32 L86 58Z" fill="#C46A3A"/><path d="M96 60 L106 28 L116 62Z" fill="#C46A3A"/>
<path d="M68 60 L64 42 L78 56Z" fill="#4A3A32"/><path d="M100 58 L105 40 L110 60Z" fill="#4A3A32"/>
<path d="M56 92 C52 74 66 60 88 58 C108 58 120 72 118 88 C116 100 104 108 90 112 C78 116 60 110 56 92Z" fill="#C46A3A"/>
<path d="M62 94 C52 96 40 98 32 103 C44 112 64 114 80 106 C76 98 70 94 62 94Z" fill="#F3E6D0"/>
</g>
<g ${INK}>
<path d="M70 186 C60 160 64 128 86 114 M124 116 C138 136 138 170 124 188"/>
<path d="M120 184 C150 192 186 180 188 150 C190 126 172 118 166 132 C176 146 166 170 130 172"/>
<path d="M66 66 L60 32 L86 58 M96 60 L106 28 L116 62"/>
<path d="M88 58 C108 58 120 72 118 88 C116 100 104 108 90 112 C80 115 68 113 60 106"/>
<path d="M56 92 C54 84 56 76 62 70"/>
<path d="M40 106 Q48 110 58 108"/>
<path d="M150 150 l6 -3 M160 160 l6 -2 M140 140 l5 -4" stroke-width="0.9"/>
</g>
<g class="detail"><ellipse cx="76" cy="84" rx="3.6" ry="3" fill="#2A1E15"/><circle cx="77" cy="83" r="1" fill="#fff"/><ellipse cx="33" cy="103" rx="3.4" ry="2.6" fill="#2A1E15"/></g>`,

  owl: `
<g class="paint">${SHADOW}
<path d="M28 184 C80 180 130 182 178 184 L178 194 C130 192 80 192 28 194Z" fill="#7A6250"/>
<path d="M56 176 C46 140 54 92 100 86 C146 92 154 140 144 176 C130 190 70 190 56 176Z" fill="#A88560"/>
<path d="M74 172 C68 142 78 118 100 116 C122 118 132 142 126 172 C116 182 84 182 74 172Z" fill="#E3D2B4"/>
<path d="M56 120 C44 140 46 166 62 178 C66 160 68 138 66 122Z" fill="#8C6A48"/>
<path d="M144 120 C156 140 154 166 138 178 C134 160 132 138 134 122Z" fill="#8C6A48"/>
<path d="M66 58 L60 38 L82 52Z" fill="#A88560"/><path d="M134 58 L140 38 L118 52Z" fill="#A88560"/>
<path d="M60 96 C56 66 76 48 100 48 C124 48 144 66 140 96 C136 116 118 124 100 124 C82 124 64 116 60 96Z" fill="#A88560"/>
<ellipse cx="84" cy="88" rx="18" ry="17" fill="#E8D9BC"/><ellipse cx="116" cy="88" rx="18" ry="17" fill="#E8D9BC"/>
<path d="M96 96 L104 96 L100 107Z" fill="#D3A24F"/>
<ellipse cx="88" cy="184" rx="7" ry="4" fill="#D3A24F"/><ellipse cx="112" cy="184" rx="7" ry="4" fill="#D3A24F"/>
</g>
<g ${INK}>
<path d="M56 176 C46 140 54 92 70 70 M130 70 C146 92 154 140 144 176"/>
<path d="M60 96 C56 66 76 48 100 48 C124 48 144 66 140 96"/>
<path d="M66 58 L60 38 L82 52 M134 58 L140 38 L118 52"/>
<path d="M84 132 l4 5 l4 -5 M104 132 l4 5 l4 -5 M92 148 l4 5 l4 -5 M80 160 l4 5 l4 -5 M108 160 l4 5 l4 -5" stroke="#8C6A48"/>
<path d="M60 136 l4 8 M62 152 l4 8 M140 136 l-4 8 M138 152 l-4 8" stroke-width="0.9"/>
<circle cx="84" cy="88" r="11" stroke="#B89A72"/><circle cx="116" cy="88" r="11" stroke="#B89A72"/>
</g>
<g class="detail">${eye(84, 88, 6)}${eye(116, 88, 6)}</g>`,

  elephant: `
<g class="paint">${SHADOW}
<path d="M56 166 L56 190 L70 190 L72 166Z" fill="#8C979A"/><path d="M110 166 L112 190 L126 190 L126 164Z" fill="#8C979A"/>
<path d="M40 150 C38 116 62 98 96 98 C128 98 140 116 140 146 C140 162 132 172 122 174 L48 174 C42 168 40 160 40 150Z" fill="#9EA7AA"/>
<path d="M72 168 L72 190 L88 190 L90 168Z" fill="#9EA7AA"/><path d="M96 168 L96 190 L112 190 L112 168Z" fill="#9EA7AA"/>
<path d="M118 110 C114 84 132 66 152 68 C172 70 182 88 178 110 C176 126 166 134 156 136Z" fill="#9EA7AA"/>
<path d="M170 120 C176 136 178 154 172 166 C170 172 178 175 182 168 C188 154 186 132 178 116Z" fill="#9EA7AA"/>
<path d="M128 86 C108 82 98 100 104 122 C108 138 124 140 134 128 C138 116 138 98 128 86Z" fill="#929B9E"/>
<path d="M124 94 C112 94 108 106 112 120 C116 130 126 128 128 120 C130 110 130 100 124 94Z" fill="#D9B2A6"/>
</g>
<g ${INK}>
<path d="M40 150 C38 116 62 98 96 98 C112 98 122 102 128 108"/>
<path d="M48 174 C42 168 40 160 40 150 M72 168 L72 190 L88 190 L90 170 M96 170 L96 190 L112 190 L112 172"/>
<path d="M140 146 C140 160 134 170 126 172"/>
<path d="M140 74 C150 66 168 66 176 80 C182 92 180 106 178 116 C186 132 188 154 182 168 C178 175 170 172 172 166 C176 152 174 136 168 124"/>
<path d="M128 86 C108 82 98 100 104 122 C108 138 124 140 134 128"/>
<path d="M40 140 C32 146 30 156 34 160"/>
<path d="M164 126 q-6 4 -12 2"/>
<path d="M174 140 l6 0 M175 150 l6 0" stroke-width="0.8"/>
</g>
<g class="detail">${eye(160, 98, 3)}</g>`,

  penguin: `
<g class="paint">${SHADOW}
<ellipse cx="90" cy="187" rx="12" ry="5" fill="#D99447"/><ellipse cx="114" cy="187" rx="12" ry="5" fill="#D99447"/>
<path d="M70 112 C54 128 48 148 52 156 C62 150 72 134 76 120Z" fill="#4E5B66"/>
<path d="M132 112 C146 124 152 140 150 148 C140 144 132 132 128 120Z" fill="#4E5B66"/>
<path d="M70 182 C56 150 58 104 80 80 C94 66 116 66 128 82 C146 106 146 152 132 182 C118 192 84 192 70 182Z" fill="#4E5B66"/>
<path d="M82 180 C72 152 76 118 92 104 C100 96 114 94 120 104 C132 130 130 162 120 180 C110 188 92 188 82 180Z" fill="#F2EFE6"/>
<path d="M114 86 L134 91 L114 96Z" fill="#D99447"/>
</g>
<g ${INK}>
<path d="M70 182 C56 150 58 104 80 80 C94 66 116 66 128 82 C146 106 146 152 132 182"/>
<path d="M70 112 C54 128 48 148 52 156 C62 150 72 134 76 120 M132 112 C146 124 152 140 150 148"/>
<path d="M82 180 C72 152 76 118 92 104"/>
<path d="M114 86 L134 91 L114 96"/>
<path d="M80 186 C84 182 96 182 100 188 M104 188 C108 182 120 182 124 186"/>
</g>
<g class="detail">${eye(106, 84, 3.2)}</g>`,

  dino: `
<g class="paint">${SHADOW}
<path d="M70 176 C40 182 22 172 18 156 C30 166 48 168 66 158Z" fill="#8FA77A"/>
<path d="M86 74 L74 64 L86 60Z M82 96 L68 92 L80 84Z M70 120 L56 118 L66 108Z M60 146 L46 146 L56 134Z M40 166 L30 158 L44 156Z" fill="#C98F6E"/>
<path d="M64 184 C52 156 58 124 82 112 C102 104 124 112 132 132 C140 152 136 176 124 188Z" fill="#8FA77A"/>
<path d="M92 100 C98 112 100 122 94 132 L130 134 C130 120 136 108 140 102Z" fill="#8FA77A"/>
<path d="M88 184 C82 160 88 128 104 118 C118 128 122 160 116 184Z" fill="#DCD9B4"/>
<path d="M88 86 C86 64 104 50 126 52 C150 54 162 70 158 88 C154 104 138 110 120 110 C102 110 90 100 88 86Z" fill="#8FA77A"/>
<path d="M124 140 C134 144 140 152 138 158 C132 156 126 150 122 146Z" fill="#8FA77A"/>
<ellipse cx="76" cy="186" rx="16" ry="7" fill="#7C9468"/><ellipse cx="122" cy="186" rx="16" ry="7" fill="#7C9468"/>
</g>
<g ${INK}>
<path d="M64 184 C52 156 58 124 82 112 M126 118 C140 140 138 172 124 188"/>
<path d="M70 176 C40 182 22 172 18 156 C30 166 48 168 66 158"/>
<path d="M88 86 C86 64 104 50 126 52 C150 54 162 70 158 88 C154 104 138 110 120 110 C104 110 92 102 89 92"/>
<path d="M92 100 C98 112 100 122 94 132"/>
<path d="M136 96 Q146 101 154 94"/>
<path d="M124 140 C134 144 140 152 138 158"/>
<path d="M92 140 l8 0 M92 152 l10 0 M94 164 l9 0" stroke="#B5B08A"/>
</g>
<g class="detail">${eye(128, 76, 3.4)}<circle cx="152" cy="80" r="1.3" fill="#3E4A34"/><g fill="#6E8560"><circle cx="110" cy="66" r="1.8"/><circle cx="104" cy="74" r="1.5"/><circle cx="114" cy="76" r="1.5"/></g></g>`,

  strawberry: `
<g class="paint">${SHADOW}
<path d="M100 172 C66 160 52 124 58 98 C64 74 136 74 142 98 C148 124 134 160 100 172Z" fill="#B9473F"/>
<path d="M70 100 C72 90 82 86 90 88 C82 96 78 108 76 122 C70 116 68 108 70 100Z" fill="#D9776A" opacity="0.8"/>
<path d="M100 82 C88 88 70 88 64 80 C76 72 90 74 100 78Z M100 82 C112 88 130 88 136 80 C124 72 110 74 100 78Z M100 80 C94 70 92 62 96 56 C104 62 106 70 100 80Z" fill="#6F8F4E"/>
<ellipse cx="82" cy="188" rx="8" ry="4" fill="#4F3A2A"/><ellipse cx="118" cy="188" rx="8" ry="4" fill="#4F3A2A"/>
</g>
<g ${INK}>
<path d="M100 172 C66 160 52 124 58 98 C62 86 70 82 80 80 M120 80 C130 82 138 86 142 98 C148 124 134 160 100 172"/>
<path d="M100 72 C100 62 104 56 110 52" stroke="#5E7A40" stroke-width="2.4"/>
<path d="M88 166 L84 186 M112 166 L116 186" stroke-width="1.6"/>
<path d="M60 118 C50 124 44 132 42 142 M140 116 C152 110 158 100 158 90" stroke-width="1.6"/>
<path d="M95 128 Q100 133 105 128"/>
</g>
<g class="detail">${eye(89, 114, 3)}${eye(111, 114, 3)}<g fill="#E8CF7E"><ellipse cx="72" cy="104" rx="1.6" ry="2.6"/><ellipse cx="128" cy="104" rx="1.6" ry="2.6"/><ellipse cx="68" cy="130" rx="1.6" ry="2.6"/><ellipse cx="132" cy="132" rx="1.6" ry="2.6"/><ellipse cx="82" cy="150" rx="1.6" ry="2.6"/><ellipse cx="118" cy="150" rx="1.6" ry="2.6"/><ellipse cx="100" cy="158" rx="1.6" ry="2.6"/><ellipse cx="100" cy="96" rx="1.6" ry="2.6"/><ellipse cx="116" cy="92" rx="1.6" ry="2.6"/><ellipse cx="84" cy="92" rx="1.6" ry="2.6"/></g></g>`,

  cupcake: `
<g class="paint">${SHADOW}
<path d="M54 116 L146 116 L134 176 L66 176Z" fill="#C9D6D8"/>
<path d="M50 118 C40 112 46 96 60 96 C60 80 80 72 92 80 C98 66 118 68 120 82 C132 76 150 86 146 100 C156 104 156 118 148 120 C120 126 80 126 50 118Z" fill="#F1E2DA"/>
<path d="M68 92 C80 84 104 82 124 92 C112 100 84 100 68 92Z" fill="#E7C9C0"/>
<circle cx="102" cy="62" r="10" fill="#B2443A"/>
<ellipse cx="84" cy="188" rx="8" ry="4" fill="#4F3A2A"/><ellipse cx="116" cy="188" rx="8" ry="4" fill="#4F3A2A"/>
</g>
<g ${INK}>
<path d="M54 116 L66 176 L134 176 L146 116"/>
<path d="M68 120 L76 174 M84 120 L88 174 M100 120 L100 174 M116 120 L112 174 M132 120 L124 174" stroke="#8FA3A8" stroke-width="1"/>
<path d="M50 118 C40 112 46 96 60 96 C60 80 80 72 92 80 C98 66 118 68 120 82 C132 76 150 86 146 100 C156 104 156 118 148 120"/>
<path d="M104 52 C106 44 112 40 118 38" stroke="#5E7A40" stroke-width="1.8"/>
<path d="M86 176 L84 186 M114 176 L116 186" stroke-width="1.6"/>
<path d="M56 140 C46 140 40 132 38 124 M144 140 C154 138 160 130 160 122" stroke-width="1.6"/>
<path d="M95 156 Q100 161 105 156"/>
</g>
<g class="detail">${eye(89, 144, 3)}${eye(111, 144, 3)}<circle cx="99" cy="59" r="2.4" fill="#fff" opacity="0.6"/><g stroke-width="2.5" stroke-linecap="round"><path d="M70 104 l5 -2" stroke="#8FA7B5"/><path d="M96 98 l5 2" stroke="#D3A24F"/><path d="M122 106 l4 3" stroke="#8FA77A"/><path d="M134 98 l4 -3" stroke="#A99BB5"/></g></g>`,

  avocado: `
<g class="paint">${SHADOW}
<path d="M100 22 C130 22 140 56 148 84 C158 110 170 130 164 156 C156 182 130 190 100 190 C70 190 44 182 36 156 C30 130 42 110 52 84 C60 56 70 22 100 22Z" fill="#5E6E3F"/>
<path d="M100 34 C122 34 130 62 136 86 C144 110 156 128 150 152 C144 172 124 178 100 178 C76 178 56 172 50 152 C44 128 56 110 64 86 C70 62 78 34 100 34Z" fill="#D9DDA0"/>
<path d="M100 40 C116 40 124 62 128 82 C112 76 90 76 72 82 C76 62 84 40 100 40Z" fill="#E6E8BC"/>
<circle cx="100" cy="146" r="25" fill="#8C5E3C"/>
<ellipse cx="92" cy="138" rx="7" ry="5" fill="#B08462"/>
</g>
<g ${INK}>
<path d="M100 22 C130 22 140 56 148 84 C158 110 170 130 164 156 C156 182 130 190 100 190 C70 190 44 182 36 156 C30 130 42 110 52 84 C60 56 70 22 100 22Z"/>
<path d="M50 152 C56 172 76 178 100 178 C124 178 144 172 150 152" stroke="#9AA36A"/>
<circle cx="100" cy="146" r="25"/>
<path d="M95 108 Q100 113 105 108"/>
<path d="M38 140 C28 136 24 128 24 120 M162 140 C172 134 176 124 174 116" stroke-width="1.6"/>
</g>
<g class="detail">${eye(89, 96, 3)}${eye(111, 96, 3)}</g>`,

  dumpling: `
<g class="paint">${SHADOW}
<path d="M28 176 C22 118 62 74 100 72 C138 74 178 118 172 176 C150 192 50 192 28 176Z" fill="#F4EEE2"/>
<path d="M32 170 C44 182 154 184 168 170 C170 178 160 186 100 188 C44 186 32 180 32 170Z" fill="#E2D6C2"/>
<path d="M90 74 C92 62 108 62 110 74 C104 78 96 78 90 74Z" fill="#EDE4D3"/>
</g>
<g ${INK}>
<path d="M28 176 C22 118 62 74 100 72 C138 74 178 118 172 176 C150 192 50 192 28 176Z"/>
<path d="M100 76 C86 84 70 96 62 108 M100 76 C92 88 86 100 84 110 M100 76 C108 88 114 100 116 110 M100 76 C114 84 130 96 138 108" stroke="#C9B9A2"/>
<path d="M90 74 C92 62 108 62 110 74"/>
<path d="M94 146 Q100 152 106 146"/>
</g>
<g class="detail">${eye(86, 132, 3)}${eye(114, 132, 3)}<ellipse cx="74" cy="142" rx="7" ry="3.5" fill="#E7B9A6" opacity="0.55"/><ellipse cx="126" cy="142" rx="7" ry="3.5" fill="#E7B9A6" opacity="0.55"/></g>`,

  cloud: `
<g class="paint">
<path d="M46 150 C22 150 18 116 42 110 C36 82 70 68 86 84 C92 54 136 50 146 82 C172 76 188 106 168 122 C186 134 176 156 154 152Z" fill="#EEF0EE"/>
<path d="M44 146 C70 156 130 156 156 148 C150 156 120 160 100 160 C80 160 56 158 44 146Z" fill="#C7D0D4"/>
</g>
<g ${INK}>
<path d="M46 150 C22 150 18 116 42 110 C36 82 70 68 86 84 C92 54 136 50 146 82 C172 76 188 106 168 122 C186 134 176 156 154 152 C120 158 80 158 46 150Z" stroke="#7F8E96"/>
<path d="M70 168 l-3 8 M100 172 l-3 8 M130 168 l-3 8 M86 182 l-2 6 M116 184 l-2 6" stroke="#8FA7B5" stroke-width="1.6"/>
<path d="M94 128 Q100 133 106 128" stroke="#5A6870"/>
</g>
<g class="detail">${eye(86, 116, 3)}${eye(114, 116, 3)}<ellipse cx="74" cy="126" rx="6" ry="3" fill="#E7B9A6" opacity="0.5"/><ellipse cx="126" cy="126" rx="6" ry="3" fill="#E7B9A6" opacity="0.5"/></g>`,

  star: `
<g class="paint">
<circle cx="100" cy="108" r="88" fill="#F3E3B0" opacity="0.45"/>
<path d="M100 26 C106 26 108 34 112 46 L124 76 L156 78 C168 79 172 86 164 94 L140 116 L148 148 C150 160 144 164 134 158 L100 138 L66 158 C56 164 50 160 52 148 L60 116 L36 94 C28 86 32 79 44 78 L76 76 L88 46 C92 34 94 26 100 26Z" fill="#E8C766"/>
<path d="M100 40 L110 70 L90 70Z" fill="#F4DE98" opacity="0.8"/>
</g>
<g ${INK}>
<path d="M100 26 C106 26 108 34 112 46 L124 76 L156 78 C168 79 172 86 164 94 L140 116 L148 148 C150 160 144 164 134 158 L100 138 L66 158 C56 164 50 160 52 148 L60 116 L36 94 C28 86 32 79 44 78 L76 76 L88 46 C92 34 94 26 100 26Z" stroke="#9E7E2E"/>
<path d="M95 112 Q100 117 105 112"/>
<path d="M30 40 l6 6 M36 40 l-6 6 M168 36 l5 5 M173 36 l-5 5 M176 170 l4 4 M180 170 l-4 4" stroke="#B89A48"/>
</g>
<g class="detail">${eye(89, 100, 3)}${eye(111, 100, 3)}</g>`,

  teapot: `
<g class="paint">${SHADOW}
<path d="M44 128 C20 122 18 156 42 160 L46 152 C32 148 32 134 46 138Z" fill="#F2EEE4"/>
<path d="M148 146 C164 140 168 118 182 108 C186 112 182 120 178 124 C172 140 166 160 146 166Z" fill="#F2EEE4"/>
<ellipse cx="98" cy="138" rx="58" ry="48" fill="#F2EEE4"/>
<path d="M50 160 C70 180 126 180 146 160 C140 178 122 186 98 186 C74 186 56 178 50 160Z" fill="#DCD6C8"/>
<path d="M58 98 C62 74 134 74 138 98 C120 104 76 104 58 98Z" fill="#F2EEE4"/>
<circle cx="98" cy="72" r="8" fill="#6F8FAF"/>
<path d="M58 98 C76 104 120 104 138 98 L136 104 C118 110 78 110 60 104Z" fill="#6F8FAF"/>
<ellipse cx="74" cy="188" rx="10" ry="4" fill="#6F8FAF"/><ellipse cx="122" cy="188" rx="10" ry="4" fill="#6F8FAF"/>
</g>
<g ${INK}>
<ellipse cx="98" cy="138" rx="58" ry="48" stroke="#5E6E86"/>
<path d="M44 128 C20 122 18 156 42 160 M148 146 C164 140 168 118 182 108 C186 112 182 120 178 124 C172 140 166 160 146 166" stroke="#5E6E86"/>
<path d="M58 98 C62 74 134 74 138 98" stroke="#5E6E86"/>
<path d="M92 152 Q98 157 104 152"/>
</g>
<g class="detail">${eye(86, 140, 3)}${eye(110, 140, 3)}<g fill="none" stroke="#6F8FAF" stroke-width="1.6" stroke-linecap="round"><path d="M56 124 c4 -8 12 -8 14 0 c-6 2 -10 2 -14 0Z"/><path d="M128 120 c4 -8 12 -8 14 0 c-6 2 -10 2 -14 0Z"/><path d="M64 160 q8 -6 16 0 M116 162 q8 -6 16 0"/><path d="M70 120 l6 4 M136 124 l-6 4"/></g><ellipse cx="78" cy="148" rx="6" ry="3" fill="#E7B9A6" opacity="0.5"/><ellipse cx="118" cy="148" rx="6" ry="3" fill="#E7B9A6" opacity="0.5"/></g>`,

  robot: `
<g class="paint">${SHADOW}
<rect x="76" y="166" width="18" height="22" rx="3" fill="#6F9A9A"/><rect x="106" y="166" width="18" height="22" rx="3" fill="#6F9A9A"/>
<rect x="44" y="128" width="16" height="34" rx="6" fill="#6F9A9A"/><rect x="140" y="128" width="16" height="34" rx="6" fill="#6F9A9A"/>
<rect x="58" y="120" width="84" height="54" rx="8" fill="#6F9A9A"/>
<rect x="72" y="130" width="56" height="34" rx="4" fill="#E9DFC6"/>
<path d="M142 140 L160 140 L160 134 L168 134 L168 152 L160 152 L160 146 L142 146Z" fill="#C9A24F"/>
<rect x="56" y="52" width="88" height="68" rx="10" fill="#6F9A9A"/>
<rect x="68" y="64" width="64" height="42" rx="6" fill="#E9DFC6"/>
<path d="M100 52 L100 34" stroke="#4F3A2A" stroke-width="2"/>
<circle cx="100" cy="30" r="6" fill="#B2443A"/>
</g>
<g ${INK}>
<rect x="58" y="120" width="84" height="54" rx="8"/>
<rect x="56" y="52" width="88" height="68" rx="10"/>
<path d="M88 96 L112 96 M90 100 L110 100" stroke-width="1.4"/>
<path d="M76 150 L124 150 M76 156 L110 156" stroke="#B8A888"/>
</g>
<g class="detail">${eye(86, 80, 6)}${eye(114, 80, 6)}<g fill="#4F3A2A"><circle cx="62" cy="58" r="1.6"/><circle cx="138" cy="58" r="1.6"/><circle cx="62" cy="114" r="1.6"/><circle cx="138" cy="114" r="1.6"/><circle cx="64" cy="126" r="1.6"/><circle cx="136" cy="126" r="1.6"/></g><circle cx="100" cy="140" r="5" fill="#B2443A"/></g>`,
};
