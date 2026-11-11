// A hand-painted sample page (same layered format Claude paints in), in the
// order it is painted on the homepage - a little story in two beats:
//   1. Papa fox waits across the stream with open arms, a frog cheers from
//      its lily pad, and little Kit sits on the near bank, not daring to
//      jump ("kit-waits");
//   2. Kit tries once more and leaps ("kit-leaps": the first Kit is taken
//      away as this one is painted).
// Each top-level group is one layer: its class says how it is painted
// (wash / paint / ink / detail) and its data-name is how the homepage's
// schedule refers to it (see HeroPainting). After changing it, re-render
// the layers: scripts/render-home-layers.cjs.
export const HOME_SCENE = `
<g class="wash" data-name="sky-land">
<rect x="-10" y="-10" width="420" height="200" fill="#E6E2CF"/>
<circle cx="252" cy="50" r="21" fill="#F6E7B4" opacity="0.9"/><circle cx="252" cy="50" r="34" fill="#F6E7B4" opacity="0.35"/>
<path d="M-10 140 C50 120 120 130 190 122 C260 114 330 128 410 116 L410 210 L-10 210Z" fill="#C9CCA4"/>
<path d="M-10 172 C90 160 200 168 300 162 C350 159 390 162 410 160 L410 320 L-10 320Z" fill="#AAB585"/>
<path d="M-10 236 C36 228 88 240 106 268 C114 284 108 302 100 320 L-10 320Z" fill="#94A270"/>
<path d="M410 232 C372 226 334 240 322 266 C316 282 322 300 330 320 L410 320Z" fill="#94A270"/>
</g>
<g class="wash" data-name="stream-trees">
<path d="M206 164 C214 161 226 161 232 164 C246 188 268 214 300 250 C316 268 330 292 338 320 L62 320 C76 286 110 250 150 220 C176 200 196 182 206 164Z" fill="#AFC7CC"/>
<path d="M214 176 C222 196 222 224 206 250 C194 270 170 292 150 316 L196 316 C214 290 234 262 236 232 C236 208 226 188 220 176Z" fill="#DCE8E6" opacity="0.75"/>
<path d="M-10 122 C-12 96 0 74 18 66 C16 42 38 22 64 24 C84 14 112 26 118 48 C136 56 142 80 130 98 C134 116 116 132 96 128 C84 142 60 144 46 134 C30 144 2 140 -10 122Z" fill="#C8873F"/>
<path d="M22 72 C24 50 44 36 66 40 C88 36 106 52 104 72 C104 90 86 100 68 96 C52 104 26 94 22 72Z" fill="#DBA450" opacity="0.85"/>
<path d="M-10 122 C6 130 28 130 44 120 C60 132 84 130 98 118 C110 122 124 114 130 98 C134 116 116 132 96 128 C84 142 60 144 46 134 C30 144 2 140 -10 122Z" fill="#B5653E" opacity="0.75"/>
<path d="M96 60 C106 56 118 62 122 74 C114 80 102 78 96 70Z" fill="#B5653E" opacity="0.6"/>
<path d="M330 164 C328 120 344 84 366 74 C390 66 412 86 410 116 L410 166Z" fill="#7A8B5A"/>
<path d="M286 162 C288 138 300 122 316 122 C330 124 338 140 336 162Z" fill="#8A9A64"/>
</g>
<g class="paint" data-name="props">
<path d="M28 240 C40 232 40 190 44 128 L60 128 C58 190 62 232 76 242 C60 246 42 246 28 240Z" fill="#7A6250"/><ellipse cx="54" cy="243" rx="34" ry="5" fill="#5E6B40" opacity="0.3"/>
<path d="M50 150 C62 140 72 126 76 112 L82 116 C78 132 68 148 56 160Z" fill="#7A6250"/>
<ellipse cx="176" cy="233" rx="18" ry="7.5" fill="#B9B2A2"/>
<ellipse cx="173" cy="230.5" rx="11" ry="3.4" fill="#D8D2C2"/>
<ellipse cx="238" cy="248" rx="20" ry="8.5" fill="#ADA696"/>
<ellipse cx="234" cy="245" rx="12" ry="3.6" fill="#D0CABA"/>
<path d="M112 285 C112 279 124 275 139 275 C154 275 166 279 166 285 C166 291 154 295 139 295 C134 295 129 294.5 125 293.5 L133 286Z" fill="#7F9A5A"/>
<ellipse cx="84" cy="297" rx="13" ry="4.5" fill="#8AA463"/>
<circle cx="20" cy="262" r="3.4" fill="#B2443A"/><circle cx="34" cy="272" r="3" fill="#D3A24F"/><circle cx="384" cy="270" r="3.4" fill="#A99BB5"/><circle cx="366" cy="284" r="3" fill="#D3A24F"/>
</g>
<g class="paint" data-name="papa" transform="translate(10 0)">
<path d="M336 238 C372 244 400 224 394 192 C392 174 378 166 368 176 C376 196 366 214 338 216Z" fill="#C2703A"/>
<path d="M394 194 C392 174 378 166 368 176 C372 184 374 190 374 198 C382 200 390 198 394 194Z" fill="#F1E3CB"/>
<path d="M300 168 C326 164 352 190 352 220 C352 242 338 252 312 252 C292 252 278 242 278 222 C278 200 286 178 300 168Z" fill="#C8743C"/>
<path d="M288 186 C298 180 312 188 314 208 C316 230 306 246 294 246 C284 242 279 228 281 212 C282 201 284 193 288 186Z" fill="#F1E3CB"/>
<ellipse cx="332" cy="234" rx="20" ry="17" fill="#BC6A33"/>
<ellipse cx="304" cy="252" rx="16" ry="6" fill="#5A3A28"/><ellipse cx="332" cy="253" rx="14" ry="5.5" fill="#5A3A28"/>
<path d="M300 180 C286 171 268 168 253 171 C249 176 251 185 258 185 C272 184 286 188 298 196Z" fill="#C8743C"/>
<ellipse cx="254" cy="178" rx="7.5" ry="6.5" fill="#5A3A28"/>
<path d="M296 199 C282 196 268 199 258 205 C255 211 260 216 266 214 C278 209 288 209 298 212Z" fill="#BC6A33"/>
<ellipse cx="259" cy="209" rx="7.5" ry="6.5" fill="#5A3A28"/>
<path d="M308 126 C310 112 316 103 323 100 C328 110 328 122 323 134Z" fill="#B9682F"/>
<path d="M282 132 C290 121 312 119 322 131 C331 144 329 160 316 168 C304 175 290 173 280 167 C272 165 262 163 253 159 C257 150 268 144 278 142 C279 138 280 135 282 132Z" fill="#C8743C"/>
<path d="M253 159 C262 163 272 165 280 167 C290 173 302 173 311 168 C304 160 292 156 282 155 C272 153 262 155 253 159Z" fill="#F1E3CB"/>
<path d="M285 131 C283 116 287 104 294 99 C300 107 305 118 305 127Z" fill="#C8743C"/>
<path d="M289 127 C288 116 290 108 294 105 C297 111 300 119 300 125Z" fill="#5A3A28"/>
<ellipse cx="300" cy="158" rx="6" ry="3.2" fill="#E7A99A" opacity="0.5"/>
</g>
<g class="ink" data-name="papa-ink" transform="translate(10 0)" fill="none" stroke="#4F3A2A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
<path d="M285 131 C283 116 287 104 294 99 C300 107 305 118 305 127"/>
<path d="M308 126 C310 112 316 103 323 100 C328 110 328 122 323 134"/>
<path d="M282 132 C280 135 279 138 278 142 C268 144 257 150 253 159 C262 163 272 165 280 167 C290 173 304 175 316 168 C327 161 331 146 323 134"/>
<path d="M300 180 C286 171 268 168 253 171 M258 185 C272 184 286 188 298 196"/>
<path d="M296 199 C282 196 268 199 258 205 M266 214 C278 209 288 209 298 212"/>
<path d="M300 168 C326 164 352 190 352 220 C352 236 344 246 332 250"/>
<path d="M338 216 C366 214 376 196 368 176 C378 166 392 174 394 192 C400 224 372 244 340 239"/>
<path d="M288 250 C292 246 312 246 318 252 M320 252 C326 248 340 248 346 253"/>
<path d="M279 147 Q285 140 291 147" stroke-width="1.6"/>
<path d="M259 163.5 C264 168.5 273 169.5 279 166.5"/>
</g>
<g class="detail" data-name="papa-detail" transform="translate(10 0)"><ellipse cx="254.5" cy="158" rx="3.4" ry="2.8" fill="#2A1E15"/></g>
<g class="paint" data-name="frog">
<ellipse cx="127" cy="282" rx="8" ry="4.5" fill="#7C9A54"/><ellipse cx="151" cy="282" rx="8" ry="4.5" fill="#7C9A54"/>
<path d="M130 269 C124 263 120 256 119 249 C122 247 125 248 126 251 C128 257 132 262 136 266Z" fill="#7C9A54"/>
<path d="M148 269 C154 263 158 256 159 249 C156 247 153 248 152 251 C150 257 146 262 142 266Z" fill="#7C9A54"/>
<circle cx="119" cy="248" r="3.4" fill="#8FAE62"/><circle cx="159" cy="248" r="3.4" fill="#8FAE62"/>
<ellipse cx="139" cy="273" rx="13" ry="11" fill="#8FAE62"/>
<ellipse cx="139" cy="277" rx="8.5" ry="6" fill="#DDE2B4"/>
<circle cx="132.5" cy="262" r="5.2" fill="#8FAE62"/><circle cx="145.5" cy="262" r="5.2" fill="#8FAE62"/>
<circle cx="132.5" cy="261.5" r="3.3" fill="#FBF6EA"/><circle cx="145.5" cy="261.5" r="3.3" fill="#FBF6EA"/>
<ellipse cx="129.5" cy="271" rx="2.6" ry="1.6" fill="#E7A99A" opacity="0.6"/><ellipse cx="148.5" cy="271" rx="2.6" ry="1.6" fill="#E7A99A" opacity="0.6"/>
</g>
<g class="detail" data-name="frog-detail"><circle cx="133.1" cy="261.6" r="1.8" fill="#2A1E15"/><circle cx="146.1" cy="261.6" r="1.8" fill="#2A1E15"/><circle cx="133.7" cy="261" r="0.6" fill="#fff"/><circle cx="146.7" cy="261" r="0.6" fill="#fff"/></g>
<g class="ink" data-name="scenery-ink" fill="none" stroke="#4F3A2A" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
<path d="M127.6 260 Q132.5 253.5 137.4 260 M140.6 260 Q145.5 253.5 150.4 260"/>
<path d="M127 269 C124 277 130 285 139 285 C148 285 154 277 151 269"/>
<path d="M134 269 Q139 274 144 269" stroke-width="1.2"/>
<path d="M130 269 C124 263 120 256 119 249 M148 269 C154 263 158 256 159 249"/>
<path d="M113 244 l-3 -4 M118 240 l-1 -5 M165 244 l3 -4 M160 240 l1 -5" stroke="#5E7A3E" stroke-width="0.9"/>
<path d="M114 288 C122 295 156 295 164 288" stroke="#4E5E38"/>
<path d="M158 233 C160 239 192 240 194 233 M218 248 C222 256 256 256 258 248" stroke-width="0.9"/>
<path d="M28 240 C40 232 40 190 44 128 M76 242 C62 232 58 190 60 128 M50 150 C62 140 72 126 76 112" stroke="#5E4A3A"/>
<path d="M46 170 l8 3 M44 196 l10 -2 M48 218 l8 4" stroke="#5E4A3A" stroke-width="0.8"/>
<path d="M190 262 q12 3 22 0 M214 284 q14 3 26 0 M252 272 q10 2 18 0 M176 300 q12 3 24 0 M230 204 q8 2 14 0 M214 186 q6 2 10 0" stroke="#6F8C94" stroke-width="0.9"/>
<path d="M4 98 q4 -5 8 0 M26 60 q4 -5 8 0 M54 40 q4 -5 8 0 M88 46 q4 -5 8 0 M110 84 q4 -5 8 0 M62 78 q4 -5 8 0 M30 108 q4 -5 8 0 M80 110 q4 -5 8 0 M112 112 q4 -5 8 0" stroke="#8A4A2A" stroke-width="0.9"/>
<path d="M346 96 q4 -5 8 0 M370 86 q4 -5 8 0 M392 102 q4 -5 8 0 M352 126 q4 -5 8 0 M384 136 q4 -5 8 0" stroke="#4E5E38" stroke-width="0.9"/>
<path d="M120 46 q5 -5 10 0 q5 -5 10 0 M160 30 q4 -4 8 0 q4 -4 8 0" transform="translate(40 4)"/>
<path d="M20 262 l0 14 M34 272 l1 10 M384 270 l0 14 M366 284 l1 10" stroke="#5E6B40"/>
<path d="M70 284 l-3 -10 M74 284 l0 -12 M78 284 l3 -9 M300 290 l-3 -10 M304 290 l0 -12 M308 290 l3 -9" stroke="#5E6B40"/>
</g>
<g class="paint" data-name="kit-waits">
<path d="M98 234 C82 236 72 226 76 213 C83 217 92 221 103 222Z" fill="#D07A3E"/>
<path d="M76 213 C74 219 75 224 78 228 C83 227 86 223 87 218 C83 217 79 215 76 213Z" fill="#F4E6CE"/>
<path d="M104 196 C116 196 125 208 125 222 C125 233 117 238 106 238 C96 238 91 230 93 217 C95 207 99 199 104 196Z" fill="#D98444"/>
<path d="M109 205 C116 207 120 217 118 229 C114 235 108 235 106 231 C104 221 105 211 109 205Z" fill="#F4E6CE"/>
<ellipse cx="111" cy="238" rx="6" ry="3.4" fill="#5A3A28"/><ellipse cx="122" cy="238" rx="6" ry="3.4" fill="#5A3A28"/>
<path d="M104 180 C98 173 91 170 86 172 C88 179 95 186 102 187Z" fill="#D07A3E"/>
<path d="M100 187 C100 176 108 170 118 172 C125 174 129 180 135 187 C129 193 122 199 112 199 C104 199 100 193 100 187Z" fill="#D98444"/>
<path d="M135 187 C129 193 122 199 112 199 C108 199 105 197 103 195 C113 195 124 191 130 187Z" fill="#F4E6CE"/>
<path d="M114 174 C112 166 114 160 118 157 C122 162 124 168 123 175Z" fill="#D98444"/>
</g>
<g class="ink" data-name="kit-waits-ink" fill="none" stroke="#4F3A2A" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
<path d="M104 180 C98 173 91 170 86 172 C88 179 95 186 102 187"/>
<path d="M114 174 C112 166 114 160 118 157 C122 162 124 168 123 175"/>
<path d="M100 187 C100 176 108 170 118 172 C125 174 129 180 135 187 C129 193 122 199 112 199 C104 199 100 193 100 187"/>
<path d="M104 198 C96 204 92 216 93 226 M125 222 C125 214 122 206 118 201"/>
<path d="M98 234 C82 236 72 226 76 213 C83 217 92 221 103 222"/>
<path d="M115.5 182.4 l6.5 -4.2" stroke-width="1.2"/>
<path d="M122.5 194.2 q3.2 -3 6.4 -0.4" stroke-width="1"/>
<path d="M138 176 q3 -4 2 -8 M143 182 q5 -3 6 -7" stroke="#8FA7B5" stroke-width="1"/>
</g>
<g class="detail" data-name="kit-waits-detail"><circle cx="120.5" cy="185" r="2.1" fill="#2A1E15"/><circle cx="121.2" cy="184.3" r="0.6" fill="#fff"/><ellipse cx="135" cy="187" rx="2" ry="1.7" fill="#2A1E15"/></g>
<g class="paint" data-name="kit-leaps" transform="translate(-14 3)">
<ellipse cx="208" cy="262" rx="22" ry="4" fill="#6F8C94" opacity="0.2"/>
<path d="M184 168 C168 172 152 184 142 200 C150 205 166 199 180 187 C186 181 190 175 190 170Z" fill="#D07A3E"/>
<path d="M150 190 C146 194 143 198 142 200 C148 204 156 201 163 196 C158 195 153 193 150 190Z" fill="#F4E6CE"/>
<path d="M184 166 C176 172 168 180 164 188 C168 193 174 191 178 185 C184 179 190 175 194 171Z" fill="#D07A3E"/>
<ellipse cx="165" cy="190" rx="5.5" ry="4.2" fill="#5A3A28"/>
<path d="M192 172 C188 180 184 190 184 198 C188 202 193 199 194 193 C196 186 198 180 201 175Z" fill="#C8743C"/>
<ellipse cx="186" cy="200" rx="5.5" ry="4.2" fill="#5A3A28"/>
<ellipse cx="199" cy="160" rx="23" ry="13.5" transform="rotate(-22 199 160)" fill="#D98444"/>
<ellipse cx="203" cy="167" rx="14" ry="5.5" transform="rotate(-22 203 167)" fill="#F4E6CE"/>
<path d="M210 153 C222 152 236 154 248 158 C251 162 247 167 242 166 C232 164 220 163 210 163Z" fill="#D98444"/>
<ellipse cx="247" cy="162" rx="5.5" ry="4.4" fill="#5A3A28"/>
<path d="M212 147 C224 142 238 142 250 144 C254 147 251 153 246 152 C236 151 224 152 214 155Z" fill="#D07A3E"/>
<ellipse cx="251" cy="148" rx="5.5" ry="4.4" fill="#5A3A28"/>
<path d="M214 128 C210 118 210 109 214 103 C220 109 224 117 225 124Z" fill="#D07A3E"/>
<path d="M210 136 C210 126 220 120 230 124 C236 126 240 132 246 138 C240 144 234 151 224 151 C214 151 210 144 210 136Z" fill="#D98444"/>
<path d="M246 138 C240 144 234 151 224 151 C220 151 217 149 215 147 C224 147 234 143 240 139Z" fill="#F4E6CE"/>
<path d="M224 124 C224 114 228 106 233 103 C237 110 237 118 235 127Z" fill="#D98444"/>
<path d="M227 123 C227 116 229 110 232 108 C234 113 234 119 233 124Z" fill="#5A3A28"/>
<ellipse cx="228" cy="143" rx="4.5" ry="2.6" fill="#E7A99A" opacity="0.55"/>
</g>
<g class="ink" data-name="kit-leaps-ink" transform="translate(-14 3)" fill="none" stroke="#4F3A2A" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
<path d="M214 128 C210 118 210 109 214 103 C220 109 224 117 225 124"/>
<path d="M224 124 C224 114 228 106 233 103 C237 110 237 118 235 127"/>
<path d="M210 136 C210 126 220 120 230 124 C236 126 240 132 246 138 C240 144 234 151 224 151 C214 151 210 144 210 136"/>
<path d="M212 147 C224 142 238 142 250 144 M210 163 C220 163 232 164 242 166"/>
<path d="M208 150 C200 146 186 150 178 160 M184 168 C168 172 152 184 142 200 C150 205 166 199 180 187"/>
<path d="M184 166 C176 172 168 180 164 188 M192 172 C188 180 184 190 184 198 M196 174 C204 176 214 172 220 166"/>
<path d="M236 143 C235 148 229 150 225 147 C229 147 233 145 236 143Z" fill="#6E3B32"/>
<path d="M150 168 l-12 4 M146 178 l-12 6" stroke-width="0.9"/>
<path d="M180 221 l-6 -10 M188 217 l-1 -12 M198 219 l5 -10 M206 225 l9 -6" stroke="#6F8C94" stroke-width="1.1"/>
</g>
<g class="detail" data-name="kit-leaps-detail" transform="translate(-14 3)"><circle cx="231.5" cy="133.5" r="2.8" fill="#2A1E15"/><circle cx="232.4" cy="132.6" r="0.9" fill="#fff"/><ellipse cx="246" cy="138" rx="2.2" ry="1.9" fill="#2A1E15"/>
<g fill="#C5D8DC"><circle cx="174" cy="211" r="2.4"/><circle cx="186" cy="205" r="1.8"/><circle cx="204" cy="209" r="2.2"/><circle cx="212" cy="219" r="1.6"/><circle cx="168" cy="221" r="1.5"/></g></g>
<g class="paint" data-name="extras">
<path d="M0 0 C6 -8 18 -8 24 -2 C16 6 6 6 0 0Z" fill="#B5653E" transform="translate(120 60) rotate(-28)"/>
<path d="M0 0 C5 -6 14 -6 18 -1 C12 5 5 5 0 0Z" fill="#C8873F" transform="translate(166 96) rotate(22)"/>
<path d="M0 0 C5 -6 14 -6 18 -1 C12 5 5 5 0 0Z" fill="#D3A24F" transform="translate(88 138) rotate(-50)"/>
<path d="M0 0 C4 -5 12 -5 15 -1 C10 4 4 4 0 0Z" fill="#B5653E" transform="translate(268 96) rotate(35)"/>
</g>
<g class="ink" data-name="finish-ink" fill="none" stroke="#4F3A2A" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round">
<path d="M122 58 l18 -8 M168 99 l14 6 M90 136 l10 -12 M270 99 l10 8" stroke="#7F3E26" stroke-width="0.7"/>
</g>
`;
