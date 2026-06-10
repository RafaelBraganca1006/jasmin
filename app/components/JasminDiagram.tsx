"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const CX = 320, CY = 112, R = 44;

const LEFT_PILLS = [
  { label: "Transcrição", cy: 42 },
  { label: "Histórico", cy: 88 },
  { label: "Agenda", cy: 136 },
  { label: "Odontograma", cy: 182 },
] as const;

const RIGHT_PILLS = [
  { label: "Diagnóstico", cy: 62,  color: "#fc5e0e", dot: [358, 90]  as const },
  { label: "Alertas",     cy: 112, color: "#fc5e0e", dot: [364, 112] as const },
  { label: "Guia TISS",  cy: 162, color: "#fc5e0e", dot: [358, 134] as const },
] as const;

const ease = [0.25, 0.1, 0.25, 1] as const;

function lPath(cy: number) {
  return `M 126,${cy} C 215,${cy} 250,${CY} ${CX - R},${CY}`;
}
function rPath(dot: readonly [number, number], cy: number) {
  return `M ${dot[0]},${dot[1]} C 430,${dot[1]} 450,${cy} 496,${cy}`;
}

export function JasminDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className="nb-diagram">
      <svg viewBox="0 0 640 224" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <clipPath id="circle-clip">
            <circle cx={CX} cy={CY} r={R - 2} />
          </clipPath>
        </defs>

        {/* Left dashed connections */}
        {LEFT_PILLS.map((p, i) => (
          <motion.path
            key={`lc-${i}`}
            d={lPath(p.cy)}
            stroke="rgba(27,23,20,0.13)"
            strokeWidth="1.5"
            strokeDasharray="3 4"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.45, delay: 0.42 + i * 0.07, ease }}
          />
        ))}

        {/* Right colored connections */}
        {RIGHT_PILLS.map((p, i) => (
          <motion.path
            key={`rc-${i}`}
            d={rPath(p.dot, p.cy)}
            stroke={p.color}
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
            transition={{ duration: 0.55, delay: 0.78 + i * 0.1, ease }}
          />
        ))}

        {/* Left dots */}
        {LEFT_PILLS.map((p, i) => (
          <motion.circle
            key={`ld-${i}`}
            cx={126} cy={p.cy} r={3}
            fill="rgba(27,23,20,0.22)"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.25, delay: 0.38 + i * 0.07, ease }}
          />
        ))}

        {/* Right colored dots at circle edge */}
        {RIGHT_PILLS.map((p, i) => (
          <motion.circle
            key={`rd-${i}`}
            cx={p.dot[0]} cy={p.dot[1]} r={4.5}
            fill={p.color}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.25, delay: 0.73 + i * 0.1, ease }}
          />
        ))}

        {/* Left pills */}
        {LEFT_PILLS.map((p, i) => (
          <motion.g
            key={`lp-${i}`}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.38, delay: 0.08 + i * 0.07, ease }}
          >
            <rect
              x={10} y={p.cy - 17} width={116} height={34} rx={17}
              fill="white" stroke="rgba(27,23,20,0.1)" strokeWidth={1}
            />
            <text
              x={68} y={p.cy + 5}
              textAnchor="middle"
              fill="#1b1714"
              fontSize={11.5}
              fontFamily="var(--font-inter), system-ui, sans-serif"
              fontWeight="500"
            >
              {p.label}
            </text>
          </motion.g>
        ))}

        {/* Halo suave externo */}
        <motion.circle
          cx={CX} cy={CY} r={R + 10}
          fill="rgba(252,94,14,0.06)"
          stroke="rgba(252,94,14,0.18)"
          strokeWidth={1}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0, ease }}
        />
        {/* Círculo central — branco com borda fina */}
        <motion.circle
          cx={CX} cy={CY} r={R}
          fill="#fff"
          stroke="#fc5e0e"
          strokeWidth={1}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease }}
        />

        {/* Logo — full logo (flower + text) scaled to fit inside the circle */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.28, ease }}
          clipPath="url(#circle-clip)"
        >
          <image
            href="/logo.png"
            x={CX - R + 8}
            y={CY - R + 8}
            width={(R - 8) * 2}
            height={(R - 8) * 2}
            preserveAspectRatio="xMidYMid meet"
          />
        </motion.g>

        {/* Right pills */}
        {RIGHT_PILLS.map((p, i) => (
          <motion.g
            key={`rp-${i}`}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.38, delay: 0.88 + i * 0.09, ease }}
          >
            <rect
              x={496} y={p.cy - 17} width={136} height={34} rx={17}
              fill="white" stroke={p.color} strokeWidth={1.5}
            />
            <text
              x={564} y={p.cy + 5}
              textAnchor="middle"
              fill="#1b1714"
              fontSize={11.5}
              fontFamily="var(--font-inter), system-ui, sans-serif"
              fontWeight="500"
            >
              {p.label}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}
