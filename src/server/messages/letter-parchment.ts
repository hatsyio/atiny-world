/** Deterministic SVG surface: worn edges and fibres stay clear of the reading area. */
export function letterParchment(width:number, height:number): string {
  const edge = 12
  const points: string[] = []
  const rough = (index:number) => Math.round(3 * Math.sin(index * 2.3) + 2 * Math.cos(index * 1.4))
  for (let x=edge, i=0; x < width-edge; x+=28, i++) points.push(`${x},${edge + rough(i)}`)
  for (let y=edge, i=20; y < height-edge; y+=32, i++) points.push(`${width-edge + rough(i)},${y}`)
  for (let x=width-edge, i=40; x > edge; x-=28, i++) points.push(`${x},${height-edge + rough(i)}`)
  for (let y=height-edge, i=60; y > edge; y-=32, i++) points.push(`${edge + rough(i)},${y}`)
  const outline = `M${points.join(' L')} Z`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#efd9aa"/><stop offset=".48" stop-color="#f5e3bc"/><stop offset="1" stop-color="#d9b678"/></linearGradient>
      <radialGradient id="edge"><stop offset=".7" stop-color="#9d642b" stop-opacity="0"/><stop offset="1" stop-color="#795025" stop-opacity=".55"/></radialGradient>
      <radialGradient id="stain"><stop stop-color="#94602e" stop-opacity=".19"/><stop offset="1" stop-color="#94602e" stop-opacity="0"/></radialGradient>
      <filter id="fibre"><feTurbulence type="fractalNoise" baseFrequency=".48 .62" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
      <clipPath id="sheet"><path d="${outline}"/></clipPath>
    </defs>
    <path d="${outline}" fill="url(#paper)" stroke="#8a5a2d" stroke-width="5"/>
    <g clip-path="url(#sheet)">
      <rect width="${width}" height="${height}" fill="url(#edge)"/>
      <ellipse cx="0" cy="${height*.2}" rx="${width*.18}" ry="${height*.25}" fill="url(#stain)"/>
      <ellipse cx="${width}" cy="${height*.75}" rx="${width*.23}" ry="${height*.18}" fill="url(#stain)"/>
      <ellipse cx="${width*.2}" cy="${height}" rx="${width*.35}" ry="${height*.12}" fill="url(#stain)"/>
      <rect width="${width}" height="${height}" filter="url(#fibre)" opacity=".085"/>
      <path d="M${width*.16},0 Q${width*.18},${height*.52} ${width*.15},${height}" stroke="#8c693e" stroke-width="2" opacity=".055" fill="none"/>
      <path d="M0,${height*.65} Q${width*.5},${height*.63} ${width},${height*.66}" stroke="#8c693e" stroke-width="2" opacity=".06" fill="none"/>
      <path d="M${width-40},${height-12} L${width-12},${height-44} L${width-12},${height-12} Z" fill="#76532d" opacity=".18"/>
    </g>
  </svg>`
  return `url(data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')})`
}
