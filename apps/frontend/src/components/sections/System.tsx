'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const NODES = [
  { id: 'patients', label: 'PATIENTS', x: 50, y: 12 },
  { id: 'clinical', label: 'CLINICAL', x: 88, y: 35 },
  { id: 'diagnostics', label: 'DIAGNOSTICS', x: 78, y: 72 },
  { id: 'operations', label: 'OPERATIONS', x: 22, y: 72 },
  { id: 'intelligence', label: 'INTELLIGENCE', x: 12, y: 35 },
  { id: 'security', label: 'SECURITY', x: 50, y: 90 },
  { id: 'workflows', label: 'WORKFLOWS', x: 78, y: 12 },
];

export default function SystemSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate nodes and lines in sequence on scroll
      const nodes = svgRef.current?.querySelectorAll('.sys-node');
      const lines = svgRef.current?.querySelectorAll('.sys-line');
      const centerLabel = svgRef.current?.querySelector('.sys-center');

      if (!nodes || !lines || !centerLabel) return;

      gsap.set(nodes, { opacity: 0, scale: 0, transformOrigin: 'center' });
      gsap.set(lines, { strokeDashoffset: 200, opacity: 0 });
      gsap.set(centerLabel, { opacity: 0, scale: 0.8, transformOrigin: 'center' });

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 65%',
        onEnter: () => {
          const tl = gsap.timeline();

          // Center first
          tl.to(centerLabel, {
            opacity: 1,
            scale: 1,
            duration: 0.8,
            ease: 'power3.out',
          })
            // Then nodes
            .to(
              nodes,
              {
                opacity: 1,
                scale: 1,
                duration: 0.6,
                stagger: 0.1,
                ease: 'back.out(1.5)',
              },
              '-=0.3'
            )
            // Then connection lines draw in
            .to(
              lines,
              {
                strokeDashoffset: 0,
                opacity: 1,
                duration: 0.8,
                stagger: 0.08,
                ease: 'power2.out',
              },
              '-=0.3'
            );
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="platform"
      className="m-section"
      style={{
        background: 'var(--m-bg-deep)',
        padding: 'clamp(6rem, 14vh, 14rem) 0',
      }}
      aria-label="MEDORA System Architecture"
    >
      <div className="m-container">
        <div className="m-label m-label-accent" style={{ marginBottom: '3rem' }}>
          03 / Platform
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(3rem, 6vw, 8rem)', alignItems: 'center' }}>
          {/* Left: text */}
          <div>
            <h2 className="m-section-head" style={{ marginBottom: '2rem' }}>
              One system.
              <br />
              <span style={{ color: 'var(--m-accent-light)' }}>Everything connected.</span>
            </h2>
            <p className="m-body" style={{ marginBottom: '2rem' }}>
              MEDORA operates as a unified operating system layer across all
              hospital touchpoints — connecting clinical teams, diagnostic
              infrastructure, operational workflows, and intelligence systems
              into a single coherent environment.
            </p>

            {/* Module list */}
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {NODES.map((n) => (
                <li
                  key={n.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    fontFamily: 'var(--m-font-label)',
                    fontSize: '0.7rem',
                    letterSpacing: '0.1em',
                    color: activeNode === n.id ? 'var(--m-accent-light)' : 'var(--m-text-tertiary)',
                    transition: 'color 0.3s',
                    cursor: 'default',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid var(--m-line)',
                  }}
                  onMouseEnter={() => setActiveNode(n.id)}
                  onMouseLeave={() => setActiveNode(null)}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: activeNode === n.id ? 'var(--m-accent-light)' : 'var(--m-accent-dim)',
                      flexShrink: 0,
                      transition: 'background 0.3s',
                    }}
                  />
                  {n.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: SVG Network Diagram */}
          <div style={{ aspectRatio: '1 / 1', position: 'relative' }}>
            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              style={{ width: '100%', height: '100%' }}
              aria-hidden="true"
            >
              {/* Connection lines */}
              {NODES.map((node) => (
                <line
                  key={`line-${node.id}`}
                  className="sys-line"
                  x1="50"
                  y1="50"
                  x2={node.x}
                  y2={node.y}
                  stroke={activeNode === node.id ? '#6aaa85' : '#3d7a5c'}
                  strokeWidth="0.3"
                  strokeDasharray="200"
                  strokeDashoffset="200"
                  opacity="0"
                  style={{ transition: 'stroke 0.3s' }}
                />
              ))}

              {/* Outer nodes */}
              {NODES.map((node) => (
                <g
                  key={node.id}
                  className="sys-node"
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseEnter={() => setActiveNode(node.id)}
                  onMouseLeave={() => setActiveNode(null)}
                  style={{ cursor: 'default' }}
                >
                  <circle
                    r="4"
                    fill={activeNode === node.id ? 'rgba(106,170,133,0.15)' : 'rgba(29,74,53,0.1)'}
                    stroke={activeNode === node.id ? '#6aaa85' : '#3d7a5c'}
                    strokeWidth="0.4"
                    style={{ transition: 'all 0.3s' }}
                  />
                  <circle
                    r="1.2"
                    fill={activeNode === node.id ? '#6aaa85' : '#3d7a5c'}
                    style={{ transition: 'fill 0.3s' }}
                  />
                  <text
                    y="-5.5"
                    textAnchor="middle"
                    fill={activeNode === node.id ? '#6aaa85' : '#4a5a48'}
                    fontSize="2.5"
                    fontFamily="Space Grotesk, sans-serif"
                    letterSpacing="0.05em"
                    style={{ transition: 'fill 0.3s' }}
                  >
                    {node.label}
                  </text>
                </g>
              ))}

              {/* Center: MEDORA */}
              <g className="sys-center">
                <circle cx="50" cy="50" r="8" fill="rgba(13,21,32,0.9)" stroke="#3d7a5c" strokeWidth="0.5" />
                <circle cx="50" cy="50" r="5" fill="rgba(29,74,53,0.4)" stroke="#6aaa85" strokeWidth="0.3" />
                <text
                  x="50"
                  y="50.8"
                  textAnchor="middle"
                  fill="#eef2ee"
                  fontSize="3.2"
                  fontFamily="Syne, sans-serif"
                  fontWeight="700"
                  letterSpacing="-0.02em"
                >
                  MEDORA
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
