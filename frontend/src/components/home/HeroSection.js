import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Sparkles, Environment, ContactShadows, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { useTheme } from '../../contexts/ThemeContext';

function checkWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch { return false; }
}

/* ── shared PBR helpers — cinematic premium quality ── */
const GOLD = {
  color: '#D4A030', roughness: 0.022, metalness: 1.0,
  envMapIntensity: 8.0, emissive: '#C09018', emissiveIntensity: 0.10,
  clearcoat: 1.0, clearcoatRoughness: 0.010,
  anisotropy: 1.0, anisotropyRotation: Math.PI / 2,
  iridescence: 0.22, iridescenceIOR: 1.55,
};
const DARK_GOLD = {
  color: '#8A5E10', roughness: 0.06, metalness: 1.0,
  envMapIntensity: 5.5, emissive: '#8A5208', emissiveIntensity: 0.055,
  clearcoat: 1.0, clearcoatRoughness: 0.025,
  iridescence: 0.12, iridescenceIOR: 1.45,
};
const BRIGHT_GOLD = {
  color: '#F8D048', roughness: 0.014, metalness: 1.0,
  envMapIntensity: 9.0, emissive: '#F0A818', emissiveIntensity: 0.18,
  clearcoat: 1.0, clearcoatRoughness: 0.006,
  iridescence: 0.28, iridescenceIOR: 1.65,
};
const MARBLE = {
  color: '#eee9e1', roughness: 0.025, metalness: 0.0,
  clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 1.4,
  sheen: 0.18, sheenColor: '#ddd5c8',
};
const DARK_WOOD = {
  color: '#0e0400', roughness: 0.16, metalness: 0.04, clearcoat: 1.0,
  clearcoatRoughness: 0.022, envMapIntensity: 1.8,
  emissive: '#220a02', emissiveIntensity: 0.020,
  sheen: 0.22, sheenColor: '#622010',
};
const MED_WOOD = { color: '#2e0e02', roughness: 0.28, metalness: 0.02, clearcoat: 0.92, clearcoatRoughness: 0.04, envMapIntensity: 1.2 };

/* ─────────────────────────────────────────────
   CINEMATIC CAMERA — flies in from far on mount
───────────────────────────────────────────── */
function CinematicCamera({ isMobile }) {
  const { camera } = useThree();
  const tRef = useRef(0);
  const done = useRef(false);
  useFrame((_, delta) => {
    if (done.current) return;
    tRef.current = Math.min(tRef.current + delta * 0.50, 1); // ~2.0 s — fast fly-in
    const ease = 1 - Math.pow(1 - tRef.current, 4);          // quartic ease-out (ultra smooth landing)
    const startZ = isMobile ? 26 : 23;
    const finalZ = isMobile ? 16 : 13;
    camera.position.z = startZ - (startZ - finalZ) * ease;
    camera.position.y = 6.5 - (6.5 - 1.5) * ease;
    camera.lookAt(0, 0, 0);
    if (tRef.current >= 1) done.current = true;
  });
  return null;
}

/* ─────────────────────────────────────────────
   RISE GROUP — objects rise from below on cue
───────────────────────────────────────────── */
function RiseGroup({ show, riseDistance = 4, children }) {
  const groupRef = useRef(null);
  const yRef = useRef(-riseDistance);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = show ? 0 : -riseDistance;
    yRef.current += (target - yRef.current) * Math.min(1, delta * 22);
    groupRef.current.position.y = yRef.current;
    groupRef.current.visible = yRef.current > -riseDistance + 0.08;
  });
  return <group ref={groupRef} visible={false}>{children}</group>;
}

/* ─────────────────────────────────────────────
   MARBLE FLOOR
───────────────────────────────────────────── */
function MarbleFloor({ isDark }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5.15, 0]} receiveShadow>
        <planeGeometry args={[50, 28]} />
        <meshPhysicalMaterial
          color={isDark ? "#0c0c0c" : "#e8e2d8"}
          roughness={isDark ? 0.5 : 0.02}
          metalness={0.0}
          clearcoat={isDark ? 0.1 : 1.0}
          clearcoatRoughness={0.03}
          reflectivity={isDark ? 0.3 : 1.0}
          envMapIntensity={isDark ? 0.5 : 2.2}
          ior={1.52}
        />
      </mesh>
      {/* Marble vein accent lines — gold in dark mode */}
      {[-8, -4, 0, 4, 8].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, -5.14, 0]}>
          <planeGeometry args={[0.015, 28]} />
          <meshPhysicalMaterial color={isDark ? "#D4AF37" : "#c8c0b0"} roughness={0.08} metalness={isDark ? 0.8 : 0.0} clearcoat={0.5} transparent opacity={isDark ? 0.22 : 0.5} />
        </mesh>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────
   MARBLE BACK WALL
───────────────────────────────────────────── */
function BackWall({ isDark }) {
  return (
    <>
      <mesh position={[0, 1.5, -7]} receiveShadow>
        <planeGeometry args={[50, 28]} />
        <meshPhysicalMaterial
          color={isDark ? "#080808" : "#cec8be"}
          roughness={isDark ? 0.9 : 0.55}
          metalness={0.0}
          clearcoat={isDark ? 0.02 : 0.3}
          clearcoatRoughness={0.3}
          envMapIntensity={isDark ? 0.05 : 0.4}
        />
      </mesh>
      {/* Wainscoting panel rail */}
      <mesh position={[0, -3.2, -6.88]}>
        <boxGeometry args={[50, 0.09, 0.06]} />
        <meshPhysicalMaterial {...GOLD} />
      </mesh>
    </>
  );
}

/* ─────────────────────────────────────────────
   CANDLE SCONCES
───────────────────────────────────────────── */
function Candle({ position }) {
  const flameRef = useRef();
  useFrame(({ clock }) => {
    if (flameRef.current) {
      const t = clock.getElapsedTime();
      flameRef.current.scale.x = 1 + Math.sin(t * 7.3 + position[0]) * 0.08;
      flameRef.current.scale.z = 1 + Math.cos(t * 9.1 + position[0]) * 0.08;
      flameRef.current.position.y = 0.18 + Math.sin(t * 6 + position[0]) * 0.012;
    }
  });
  return (
    <group position={position}>
      {/* Candle body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.055, 0.06, 0.55, 20]} />
        <meshPhysicalMaterial color="#f5f0e4" roughness={0.85} metalness={0.0} clearcoat={0.1} />
      </mesh>
      {/* Wick */}
      <mesh position={[0, 0.29, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.06, 6]} />
        <meshStandardMaterial color="#1a0e00" roughness={1.0} metalness={0.0} />
      </mesh>
      {/* Flame */}
      <group ref={flameRef} position={[0, 0.18, 0]}>
        <mesh>
          <coneGeometry args={[0.028, 0.1, 12]} />
          <meshStandardMaterial color="#ff9900" emissive="#ff6600" emissiveIntensity={2.5}
            transparent opacity={0.92} roughness={0.0} metalness={0.0} />
        </mesh>
        <mesh position={[0, -0.03, 0]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshStandardMaterial color="#ffdd44" emissive="#ffaa00" emissiveIntensity={3.0}
            transparent opacity={0.88} roughness={0.0} metalness={0.0} />
        </mesh>
      </group>
      {/* Wax drip */}
      <mesh position={[0.028, 0.18, 0]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshPhysicalMaterial color="#f0ebe0" roughness={0.7} metalness={0.0} />
      </mesh>
      {/* Brass holder */}
      <mesh position={[0, -0.29, 0]}>
        <cylinderGeometry args={[0.09, 0.07, 0.04, 20]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={0.6} clearcoatRoughness={0.1} />
      </mesh>
      <mesh position={[0, -0.31, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.018, 20]} />
        <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.5} />
      </mesh>
      {/* Point light from flame */}
      <pointLight position={[0, 0.2, 0]} intensity={1.4} color="#ff8800" distance={7} decay={2} />
    </group>
  );
}

function Candles() {
  return (
    <>
      <Candle position={[-4.2, -4.32, 1.1]} />
      <Candle position={[5.0, -4.32, 1.1]} />
      <Candle position={[-2.0, -4.32, 1.0]} />
    </>
  );
}

/* ─────────────────────────────────────────────
   SOUND BLOCK
───────────────────────────────────────────── */
function SoundBlock() {
  return (
    <group position={[0.3, -4.63, 0.3]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.1, 0.32, 1.15]} />
        <meshPhysicalMaterial color="#100602" roughness={0.25} metalness={0.08}
          clearcoat={0.9} clearcoatRoughness={0.04} envMapIntensity={1.4} />
      </mesh>
      <mesh position={[0, 0.162, 0]}>
        <boxGeometry args={[1.85, 0.06, 0.9]} />
        <meshPhysicalMaterial color="#2a1208" roughness={0.3} metalness={0.05}
          clearcoat={0.7} clearcoatRoughness={0.06} />
      </mesh>
      {[-1.0, 1.0].map((x, i) => (
        <mesh key={i} position={[x, 0.02, 0]}>
          <boxGeometry args={[0.06, 0.35, 1.16]} />
          <meshPhysicalMaterial {...GOLD} clearcoat={0.7} clearcoatRoughness={0.08} />
        </mesh>
      ))}
      {[-0.575, 0.575].map((z, i) => (
        <mesh key={i} position={[0, 0.02, z]}>
          <boxGeometry args={[2.12, 0.35, 0.06]} />
          <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.195, 0]}>
        <boxGeometry args={[1.0, 0.012, 0.58]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.04} emissiveIntensity={0.08} />
      </mesh>
      {/* Inset decorative oval */}
      {[-0.55, 0, 0.55].map((x, i) => (
        <mesh key={i} position={[x, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.012, 10, 28]} />
          <meshPhysicalMaterial {...GOLD} clearcoat={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────
   JUDGE'S BENCH
───────────────────────────────────────────── */
function JudgeBench() {
  return (
    <group position={[0, -4.82, -1.2]}>
      {/* Main bench top — ultra-glossy lacquered ebony */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[18, 0.38, 4.0]} />
        <meshPhysicalMaterial {...DARK_WOOD} />
      </mesh>
      {/* Bench top inset panel — slightly raised lighter wood for contrast */}
      <mesh position={[0, 0.20, 0]}>
        <boxGeometry args={[17.4, 0.025, 3.6]} />
        <meshPhysicalMaterial color="#180a02" roughness={0.12} metalness={0.02}
          clearcoat={1.0} clearcoatRoughness={0.015} envMapIntensity={2.0}
          emissive="#220e04" emissiveIntensity={0.015} />
      </mesh>
      {/* Front fascia panel */}
      <mesh position={[0, -1.6, 1.92]} receiveShadow>
        <boxGeometry args={[18, 3.2, 0.32]} />
        <meshPhysicalMaterial color="#0c0600" roughness={0.20} metalness={0.02}
          clearcoat={1.0} clearcoatRoughness={0.022} envMapIntensity={1.6}
          emissive="#1a0a02" emissiveIntensity={0.018}
          sheen={0.15} sheenColor="#5a1e0a" />
      </mesh>
      {/* Gold top rail — thicker, more prominent */}
      <mesh position={[0, 0.24, 1.93]}>
        <boxGeometry args={[18.05, 0.09, 0.12]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.018}
          emissiveIntensity={0.08} />
      </mesh>
      {/* Gold mid rail */}
      <mesh position={[0, -1.58, 1.93]}>
        <boxGeometry args={[18.05, 0.055, 0.10]} />
        <meshPhysicalMaterial {...DARK_GOLD} clearcoat={1.0} clearcoatRoughness={0.022} />
      </mesh>
      {/* Gold bottom rail */}
      <mesh position={[0, -3.15, 1.93]}>
        <boxGeometry args={[18.05, 0.09, 0.12]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.018}
          emissiveIntensity={0.08} />
      </mesh>
      {/* Raised panel sections between pilasters */}
      {[-7.25, -4.75, -2.25, 0.25, 2.75, 5.25].map((x, i) => (
        <mesh key={i} position={[x, -1.58, 1.96]}>
          <boxGeometry args={[2.3, 2.9, 0.06]} />
          <meshPhysicalMaterial color="#140800" roughness={0.24} metalness={0.0}
            clearcoat={0.85} clearcoatRoughness={0.03} envMapIntensity={1.2} />
        </mesh>
      ))}
      {/* Vertical pilasters — thicker, more architectural */}
      {[-8.5, -6.0, -3.5, -1.0, 1.5, 4.0, 6.5].map((x, i) => (
        <group key={i} position={[x, -1.58, 1.97]}>
          <mesh>
            <boxGeometry args={[0.11, 3.2, 0.11]} />
            <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.9} />
          </mesh>
          {/* Pilaster capital */}
          <mesh position={[0, 1.65, 0]}>
            <boxGeometry args={[0.16, 0.08, 0.16]} />
            <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.02} />
          </mesh>
          <mesh position={[0, -1.65, 0]}>
            <boxGeometry args={[0.16, 0.08, 0.16]} />
            <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.02} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────
   CORINTHIAN PILLAR — full detail
───────────────────────────────────────────── */
function PillarWithFluting({ position, scale = 1 }) {
  const FLUTES = 24;
  const H = 10.2 * scale;
  const S = scale;

  /* shared stone material — warmer Carrara marble tones */
  const stone = (lightness = 0) => ({
    roughness: 0.38 + lightness * 0.06,
    metalness: 0.0,
    clearcoat: 0.55 - lightness * 0.04,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.85,
    sheen: 0.06,
    sheenColor: '#ddd8cc',
  });

  return (
    <group position={position}>

      {/* ── SHAFT with entasis — warmer ivory stone ── */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24 * S, 0.32 * S, H * 0.5, 64]} />
        <meshPhysicalMaterial color="#e8e3d8" {...stone()} />
      </mesh>
      <mesh position={[0, 0.5 + H * 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.23 * S, 0.24 * S, H * 0.5, 64]} />
        <meshPhysicalMaterial color="#e6e1d6" {...stone()} />
      </mesh>

      {/* ── FLUTING — deeper channels, higher contrast ── */}
      {Array.from({ length: FLUTES }).map((_, i) => {
        const angle = (i / FLUTES) * Math.PI * 2;
        const r = 0.255 * S;
        return (
          <mesh key={i}
            position={[Math.sin(angle) * r, 0.5, Math.cos(angle) * r]}
            rotation={[0, -angle + Math.PI / 2, 0]} castShadow>
            <cylinderGeometry args={[0.019 * S, 0.019 * S, H - 0.6, 10, 1, false, 0, Math.PI]} />
            <meshPhysicalMaterial color="#b8b2a2" roughness={0.58} metalness={0.0}
              clearcoat={0.22} clearcoatRoughness={0.18} envMapIntensity={0.5} />
          </mesh>
        );
      })}

      {/* ── CORINTHIAN CAPITAL ── */}
      <group position={[0, H / 2 + 0.55, 0]}>
        {/* Kalathos (bell-shaped core) */}
        <mesh castShadow>
          <cylinderGeometry args={[0.52 * S, 0.26 * S, 0.72 * S, 44]} />
          <meshPhysicalMaterial color="#d6d0c2" {...stone(0.1)} />
        </mesh>

        {/* Lower acanthus leaf tier — 8 leaves */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <group key={i} position={[Math.sin(a) * 0.38 * S, -0.18 * S, Math.cos(a) * 0.38 * S]}
              rotation={[-0.55, a + Math.PI, 0]}>
              <mesh castShadow>
                <coneGeometry args={[0.085 * S, 0.38 * S, 7]} />
                <meshPhysicalMaterial color="#cdc7b6" roughness={0.52} metalness={0.0} clearcoat={0.2} />
              </mesh>
              {/* leaf tip curl */}
              <mesh position={[0, 0.22 * S, 0.04 * S]} rotation={[0.6, 0, 0]}>
                <torusGeometry args={[0.032 * S, 0.012 * S, 8, 14, Math.PI]} />
                <meshPhysicalMaterial color="#c4beae" roughness={0.55} metalness={0.0} />
              </mesh>
            </group>
          );
        })}

        {/* Upper acanthus leaf tier — 8 smaller leaves */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          return (
            <group key={i} position={[Math.sin(a) * 0.44 * S, 0.08 * S, Math.cos(a) * 0.44 * S]}
              rotation={[-0.38, a + Math.PI, 0]}>
              <mesh castShadow>
                <coneGeometry args={[0.065 * S, 0.28 * S, 7]} />
                <meshPhysicalMaterial color="#d0cabb" roughness={0.5} metalness={0.0} clearcoat={0.22} />
              </mesh>
            </group>
          );
        })}

        {/* Volute scrolls — 4 corners */}
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
          <group key={i} position={[Math.sin(a) * 0.46 * S, 0.28 * S, Math.cos(a) * 0.46 * S]}
            rotation={[0, a, 0]}>
            <mesh>
              <torusGeometry args={[0.075 * S, 0.022 * S, 12, 24, Math.PI * 1.5]} />
              <meshPhysicalMaterial color="#c8c2b2" roughness={0.5} metalness={0.0} clearcoat={0.3} />
            </mesh>
            {/* Gold volute centre eye */}
            <mesh position={[0.075 * S, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.014 * S, 0.014 * S, 0.012 * S, 12]} />
              <meshPhysicalMaterial {...GOLD} clearcoat={0.9} />
            </mesh>
          </group>
        ))}

        {/* Abacus (flat top slab) — 3 layers */}
        <mesh position={[0, 0.52 * S, 0]} castShadow>
          <boxGeometry args={[1.12 * S, 0.13 * S, 1.12 * S]} />
          <meshPhysicalMaterial color="#d0c9ba" {...stone(0.15)} />
        </mesh>
        <mesh position={[0, 0.62 * S, 0]}>
          <boxGeometry args={[1.18 * S, 0.07 * S, 1.18 * S]} />
          <meshPhysicalMaterial color="#c8c2b2" {...stone(0.2)} />
        </mesh>
        {/* Gold accent line on abacus edge */}
        <mesh position={[0, 0.66 * S, 0]}>
          <boxGeometry args={[1.2 * S, 0.018 * S, 1.2 * S]} />
          <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.7} />
        </mesh>
      </group>

      {/* ── BASE — Attic base with torus moldings ── */}
      <group position={[0, -H / 2 + 0.05, 0]}>
        {/* Upper torus (scotiae) */}
        <mesh castShadow>
          <torusGeometry args={[0.34 * S, 0.075 * S, 20, 40]} />
          <meshPhysicalMaterial color="#d2ccc0" {...stone(0.05)} />
        </mesh>
        {/* Dado cylinder */}
        <mesh position={[0, -0.16 * S, 0]}>
          <cylinderGeometry args={[0.48 * S, 0.48 * S, 0.22 * S, 40]} />
          <meshPhysicalMaterial color="#cac4b6" {...stone(0.1)} />
        </mesh>
        {/* Lower torus */}
        <mesh position={[0, -0.28 * S, 0]}>
          <torusGeometry args={[0.42 * S, 0.055 * S, 16, 36]} />
          <meshPhysicalMaterial color="#c8c2b4" {...stone(0.12)} />
        </mesh>
        {/* Plinth (square base) */}
        <mesh position={[0, -0.44 * S, 0]} castShadow>
          <boxGeometry args={[1.1 * S, 0.2 * S, 1.1 * S]} />
          <meshPhysicalMaterial color="#bdb7a8" {...stone(0.2)} />
        </mesh>
        {/* Gold plinth trim */}
        <mesh position={[0, -0.35 * S, 0]}>
          <boxGeometry args={[1.12 * S, 0.018 * S, 1.12 * S]} />
          <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function Pillars() {
  return (
    <>
      {[-6.5, 6.5, -10.5, 10.5].map((x, i) => (
        <PillarWithFluting key={i} position={[x, 0.2, -3.5]} />
      ))}
      {/* Main entablature */}
      <mesh position={[0, 5.82, -3.5]}>
        <boxGeometry args={[26, 0.44, 0.42]} />
        <meshPhysicalMaterial color="#d8d2c4" roughness={0.6} metalness={0.0} clearcoat={0.3} />
      </mesh>
      <mesh position={[0, 6.1, -3.5]}>
        <boxGeometry args={[26, 0.16, 0.56]} />
        <meshPhysicalMaterial color="#ccc6b8" roughness={0.62} metalness={0.0} clearcoat={0.25} />
      </mesh>
      {/* Dentil molding */}
      {Array.from({ length: 26 }).map((_, i) => (
        <mesh key={i} position={[-12.5 + i * 1.0, 5.7, -3.38]}>
          <boxGeometry args={[0.46, 0.2, 0.18]} />
          <meshPhysicalMaterial color="#dcd6c8" roughness={0.65} metalness={0.0} clearcoat={0.2} />
        </mesh>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────
   SCALES OF JUSTICE — heavy, detailed
───────────────────────────────────────────── */
function ChainAssembly({ x, topY, panY, count = 14 }) {
  const step = (panY - topY) / (count - 1);
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} position={[x, topY + i * step, 0]}
          rotation={[i % 2 === 0 ? 0 : Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.024, 0.0082, 10, 18]} />
          <meshPhysicalMaterial {...GOLD} clearcoat={0.8} clearcoatRoughness={0.06} />
        </mesh>
      ))}
    </>
  );
}

function ScalePan({ x }) {
  /* Concave bowl using stacked shrinking discs */
  const BOWL_LAYERS = 7;
  return (
    <group position={[x, 0, 0]}>
      {/* Outer heavy rim ring */}
      <mesh castShadow>
        <torusGeometry args={[0.40, 0.042, 28, 64]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.03}
          anisotropy={0.8} anisotropyRotation={0} />
      </mesh>
      {/* Rim bevel inner edge */}
      <mesh>
        <torusGeometry args={[0.36, 0.018, 16, 56]} />
        <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.8} clearcoatRoughness={0.05} />
      </mesh>

      {/* Deep concave bowl — layers of shrinking, descending discs */}
      {Array.from({ length: BOWL_LAYERS }).map((_, i) => {
        const t = i / (BOWL_LAYERS - 1);
        const r = 0.38 * (1 - t * 0.72);
        const y = -0.015 - t * t * 0.14;
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r - 0.028, r, 48]} />
            <meshPhysicalMaterial
              color={i === 0 ? '#b8920e' : '#C9A84C'}
              roughness={0.06 + i * 0.04}
              metalness={1.0}
              envMapIntensity={3.5 - i * 0.3}
              emissive="#C9A84C"
              emissiveIntensity={0.03}
              clearcoat={1.0}
              clearcoatRoughness={0.03}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* Bowl floor disc */}
      <mesh position={[0, -0.155, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.095, 36]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.02}
          emissive="#C9A84C" emissiveIntensity={0.05} />
      </mesh>

      {/* Three suspension chains — with connector rings */}
      {[0, Math.PI * 2 / 3, Math.PI * 4 / 3].map((angle, i) => {
        const px = Math.sin(angle) * 0.35;
        const pz = Math.cos(angle) * 0.35;
        return (
          <group key={i}>
            {/* Attachment ring on rim */}
            <mesh position={[px * 0.95, 0.02, pz * 0.95]} rotation={[Math.PI / 2, angle, 0]}>
              <torusGeometry args={[0.022, 0.008, 10, 18]} />
              <meshPhysicalMaterial {...GOLD} clearcoat={0.9} />
            </mesh>
            {/* Chain rod */}
            <mesh position={[px * 0.88, 0.5, pz * 0.88]}
              rotation={[Math.atan2(0.5, 0.04), angle, 0]}>
              <cylinderGeometry args={[0.007, 0.007, 1.0, 8]} />
              <meshPhysicalMaterial {...GOLD} clearcoat={0.8} />
            </mesh>
            {/* Top connector knob */}
            <mesh position={[px * 0.3, 0.92, pz * 0.3]}>
              <sphereGeometry args={[0.022, 14, 14]} />
              <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.02} />
            </mesh>
          </group>
        );
      })}

      {/* Central gathering ring where chains meet */}
      <mesh position={[0, 0.98, 0]}>
        <torusGeometry args={[0.052, 0.016, 14, 28]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.02} />
      </mesh>
    </group>
  );
}

function ScalesOfJustice() {
  const swingRef = useRef();
  useFrame(({ clock }) => {
    if (swingRef.current) {
      swingRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.42) * 0.028;
    }
  });
  return (
    <group position={[-3.2, -4.65, 0.55]}>
      {/* Stepped marble plinth */}
      {[
        [0, 0.04, [0.62, 0.08, 0.62]],
        [0, -0.04, [0.76, 0.1, 0.76]],
        [0, -0.15, [0.88, 0.14, 0.88]],
      ].map(([x, y, size], i) => (
        <mesh key={i} position={[x, y, 0]} castShadow>
          <boxGeometry args={size} />
          <meshPhysicalMaterial color="#eae4da" roughness={0.12} metalness={0.0}
            clearcoat={0.9} clearcoatRoughness={0.04} envMapIntensity={0.8} />
        </mesh>
      ))}
      {/* Column */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.044, 2.18, 32]} />
        <meshPhysicalMaterial {...BRIGHT_GOLD} />
      </mesh>
      {/* Decorative rings on column */}
      {[0.32, 0.78, 1.42, 1.88].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <torusGeometry args={[0.058, 0.014, 14, 28]} />
          <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.04} />
        </mesh>
      ))}
      {/* Top finial sphere */}
      <mesh position={[0, 2.28, 0]}>
        <sphereGeometry args={[0.075, 48, 48]} />
        <meshPhysicalMaterial {...BRIGHT_GOLD} emissiveIntensity={0.12} />
      </mesh>
      {/* Flame */}
      <mesh position={[0, 2.46, 0]}>
        <coneGeometry args={[0.036, 0.2, 16]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={0.8} />
      </mesh>
      {/* ── Animated pendulum group — beam + arms + chains + pans all pivot at column top ── */}
      <group ref={swingRef} position={[0, 2.12, 0]}>
        {/* Cross-beam — static slight tilt preserved on the mesh, pendulum on parent group */}
        <mesh rotation={[0, 0, 0.055]}>
          <cylinderGeometry args={[0.016, 0.016, 2.28, 24]} />
          <meshPhysicalMaterial {...BRIGHT_GOLD} />
        </mesh>
        {/* Arm end knobs */}
        {[-1.05, 1.05].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <sphereGeometry args={[0.036, 32, 32]} />
            <meshPhysicalMaterial {...BRIGHT_GOLD} />
          </mesh>
        ))}
        {/* Chains — y offset by -2.12 into local swing-group space */}
        <ChainAssembly x={-1.05} topY={-0.40} panY={-0.98} count={12} />
        <ChainAssembly x={1.05} topY={-0.40} panY={-0.98} count={12} />
        {/* Pans */}
        <group position={[0, -0.98, 0]}>
          <ScalePan x={-1.05} />
          <ScalePan x={1.05} />
        </group>
      </group>
    </group>
  );
}

/* ─────────────────────────────────────────────
   LAW BOOKS — premium leather volumes
───────────────────────────────────────────── */
function LawBook({ position, rotation, color, h, w, d }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Premium leather cover — deep clearcoat, rich sheen */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshPhysicalMaterial color={color} roughness={0.62} metalness={0.0}
          clearcoat={0.28} clearcoatRoughness={0.32}
          sheen={0.42} sheenColor="#b09070"
          envMapIntensity={0.55}
          emissive={color} emissiveIntensity={0.012} />
      </mesh>
      {/* Round spine — cylinder, richer leather */}
      <mesh position={[-w / 2, 0, 0]}>
        <cylinderGeometry args={[h / 2, h / 2, d + 0.006, 28, 1, false, -Math.PI / 2, Math.PI]} />
        <meshPhysicalMaterial color={color} roughness={0.60} metalness={0.0}
          clearcoat={0.25} clearcoatRoughness={0.34}
          sheen={0.38} sheenColor="#b09070" />
      </mesh>
      {/* Spine gold inlay band */}
      <mesh position={[-w / 2 + 0.013, 0, 0]}>
        <boxGeometry args={[0.026, h - 0.008, d + 0.008]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.06}
          emissiveIntensity={0.06} />
      </mesh>
      {/* Pages block — warm cream */}
      <mesh position={[w / 2 - 0.018, 0, 0]}>
        <boxGeometry args={[0.038, h - 0.014, d - 0.016]} />
        <meshPhysicalMaterial color="#f6f1e6" roughness={0.94} metalness={0.0} clearcoat={0.04} />
      </mesh>
      {/* Pages micro-lines */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[w / 2 - 0.016, -h / 2 + 0.012 + i * (h - 0.025) / 7 + (h - 0.025) / 14, 0]}>
          <boxGeometry args={[0.040, 0.0032, d - 0.018]} />
          <meshPhysicalMaterial color="#ddd8cc" roughness={0.96} metalness={0.0} />
        </mesh>
      ))}
      {/* Gold corner bosses — top & bottom */}
      {[-h / 2 + 0.016, h / 2 - 0.016].map((y, i) => (
        <mesh key={i} position={[-w / 2 + 0.013, y, 0]}>
          <boxGeometry args={[0.028, 0.024, d + 0.006]} />
          <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.9} clearcoatRoughness={0.04} />
        </mesh>
      ))}
      {/* Raised spine title panel */}
      <mesh position={[-w / 2 + 0.015, h * 0.20, 0]}>
        <boxGeometry args={[0.030, h * 0.32, d * 0.54]} />
        <meshPhysicalMaterial color="#d4a830" roughness={0.14} metalness={0.95}
          envMapIntensity={3.0} emissive="#c09820" emissiveIntensity={0.06}
          clearcoat={1.0} clearcoatRoughness={0.07}
          iridescence={0.10} iridescenceIOR={1.4} />
      </mesh>
      {/* Decorative spine ribbing bands */}
      {[-h * 0.28, h * 0.06, h * 0.38].map((y, i) => (
        <mesh key={i} position={[-w / 2 + 0.013, y, 0]}>
          <boxGeometry args={[0.026, 0.010, d + 0.007]} />
          <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.85} />
        </mesh>
      ))}
      {/* Silk bookmark ribbon */}
      <mesh position={[w / 2 - 0.022, -h / 2 - 0.04, d * 0.22]}>
        <boxGeometry args={[0.013, 0.09, 0.006]} />
        <meshPhysicalMaterial color="#D4A030" roughness={0.42} metalness={0.0}
          clearcoat={0.15} transparent opacity={0.92}
          sheen={0.5} sheenColor="#F0C050" />
      </mesh>
    </group>
  );
}

function LawBooks() {
  const BOOKS = [
    { h: 0.24, w: 0.95, d: 0.66, color: '#5a1020' },
    { h: 0.20, w: 0.91, d: 0.63, color: '#182438' },
    { h: 0.23, w: 0.93, d: 0.64, color: '#183018' },
    { h: 0.19, w: 0.89, d: 0.62, color: '#28100a' },
    { h: 0.22, w: 0.92, d: 0.64, color: '#221a60' },
    { h: 0.18, w: 0.88, d: 0.61, color: '#1a2818' },
    { h: 0.21, w: 0.90, d: 0.63, color: '#3a1808' },
  ];
  const RY = [0.04, -0.05, 0.07, -0.03, 0.05, -0.06, 0.03];
  let cumY = 0;
  return (
    <group position={[3.4, -4.65, 0.45]}>
      {BOOKS.map((b, i) => {
        const yPos = cumY + b.h / 2;
        cumY += b.h;
        return (
          <LawBook key={i}
            position={[i * 0.025 - 0.08, yPos, 0]}
            rotation={[0, RY[i], 0]}
            color={b.color} h={b.h} w={b.w} d={b.d} />
        );
      })}
      {/* Gold bookend */}
      <mesh position={[-0.72, 0.28, 0]}>
        <boxGeometry args={[0.06, 0.58, 0.65]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.06}
          anisotropy={0.7} anisotropyRotation={0} />
      </mesh>
      <mesh position={[-0.72, -0.01, 0.34]}>
        <boxGeometry args={[0.06, 0.07, 0.65]} />
        <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.8} />
      </mesh>
      {/* Seal / medallion leaning on books */}
      <mesh position={[0.1, 0.62, 0.34]} rotation={[0.15, 0.2, 0.08]}>
        <cylinderGeometry args={[0.18, 0.18, 0.024, 40]} />
        <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.03}
          emissive="#C9A84C" emissiveIntensity={0.06} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────
   GAVEL — highly detailed
───────────────────────────────────────────── */
function GavelMesh({ gavelRef, onStrike, isDark }) {
  return (
    <Float speed={0.55} rotationIntensity={0.022} floatIntensity={0.28}>
      <group ref={gavelRef} position={[0.3, -0.5, 1.6]}
        rotation={[0.15, -0.25, -0.72]} scale={1.55}
        onClick={onStrike} style={{ cursor: 'pointer' }}>

        {/* ── HANDLE — premium ebony rosewood, deeply lacquered ── */}
        {/* Lower shaft */}
        <mesh position={[0, -3.1, 0]} castShadow>
          <cylinderGeometry args={[0.19, 0.218, 3.1, 80]} />
          <meshPhysicalMaterial color="#180600" roughness={0.13} metalness={0.04}
            clearcoat={1.0} clearcoatRoughness={0.018}
            envMapIntensity={2.2} emissive="#1e0800" emissiveIntensity={0.022}
            sheen={0.28} sheenColor="#6a2812" />
        </mesh>
        {/* Upper shaft — tapers to ferrule */}
        <mesh position={[0, -1.1, 0]} castShadow>
          <cylinderGeometry args={[0.108, 0.19, 2.0, 80]} />
          <meshPhysicalMaterial color="#200a02" roughness={0.12} metalness={0.04}
            clearcoat={1.0} clearcoatRoughness={0.016}
            envMapIntensity={2.4} emissive="#1e0800" emissiveIntensity={0.018}
            sheen={0.24} sheenColor="#6a2812" />
        </mesh>
        {/* Wood grain rings — richer color contrast */}
        {[-3.9, -3.4, -2.8, -2.2, -1.6, -1.0].map((y, i) => (
          <mesh key={i} position={[0, y, 0]}>
            <torusGeometry args={[0.212 - Math.abs(y + 2.2) * 0.005, 0.0055, 12, 56]} />
            <meshPhysicalMaterial color={i % 2 === 0 ? '#5a1e0a' : '#160502'}
              roughness={0.28} metalness={0.0} clearcoat={0.7} clearcoatRoughness={0.04} />
          </mesh>
        ))}
        {/* Handle end cap — sculpted bulb base */}
        <mesh position={[0, -4.72, 0]} castShadow>
          <sphereGeometry args={[0.218, 56, 56]} />
          <meshPhysicalMaterial color="#160400" roughness={0.25} metalness={0.02}
            clearcoat={1.0} clearcoatRoughness={0.06} envMapIntensity={1.8}
            sheen={0.18} sheenColor="#5a1e0a" />
        </mesh>
        {/* Gold base cap ring — thicker, more detailed */}
        <mesh position={[0, -4.54, 0]}>
          <torusGeometry args={[0.215, 0.022, 20, 56]} />
          <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.02} />
        </mesh>
        <mesh position={[0, -4.52, 0]}>
          <torusGeometry args={[0.215, 0.008, 14, 56]} />
          <meshPhysicalMaterial {...BRIGHT_GOLD} clearcoat={1.0} clearcoatRoughness={0.005} />
        </mesh>
        {/* Leather grip wrapping — 10 tight bands */}
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i} position={[0, -2.0 + i * 0.21, 0]}>
            <torusGeometry args={[0.157 - i * 0.003, 0.016, 18, 56]} />
            <meshPhysicalMaterial color="#0c0502" roughness={0.94} metalness={0.0}
              clearcoat={0.05} sheenColor="#3a1208" sheen={0.28} />
          </mesh>
        ))}
        {/* Leather between grip bands */}
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} position={[0, -1.9 + i * 0.21, 0]}>
            <cylinderGeometry args={[0.154 - i * 0.002, 0.154 - i * 0.002, 0.18, 44]} />
            <meshPhysicalMaterial color="#120602" roughness={0.90} metalness={0.0}
              clearcoat={0.08} sheen={0.12} sheenColor="#2a0e04" />
          </mesh>
        ))}

        {/* ── COLLAR / FERRULE — gold glow boost in dark mode ── */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.275, 0.285, 0.58, 48]} />
          <meshPhysicalMaterial {...GOLD} clearcoat={1.0} clearcoatRoughness={0.03}
            anisotropy={1.0} anisotropyRotation={Math.PI / 2}
            emissive="#C9A84C" emissiveIntensity={isDark ? 0.38 : 0.06} />
        </mesh>
        {/* Collar engraving rings */}
        {[-0.26, -0.09, 0.09, 0.26].map((y, i) => (
          <mesh key={i} position={[0, 0.08 + y, 0]}>
            <torusGeometry args={[0.287, i % 2 === 0 ? 0.011 : 0.007, 16, 48]} />
            <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.9}
              emissive="#b88020" emissiveIntensity={isDark ? 0.18 : 0.04} />
          </mesh>
        ))}
        {/* Ferrule top transition disk */}
        <mesh position={[0, 0.39, 0]}>
          <cylinderGeometry args={[0.24, 0.275, 0.06, 40]} />
          <meshPhysicalMaterial {...DARK_GOLD} clearcoat={0.8} />
        </mesh>

        {/* ── HEAD — premium ebony with mirror-polished dark finish ── */}
        {/* Main barrel — ultra-high poly, near-mirror surface */}
        <mesh position={[0, 0.72, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.628, 0.618, 3.0, 128]} />
          <meshPhysicalMaterial
            color={isDark ? "#020100" : "#060100"}
            roughness={isDark ? 0.025 : 0.07}
            metalness={isDark ? 0.72 : 0.45}
            clearcoat={1.0} clearcoatRoughness={0.008}
            envMapIntensity={isDark ? 12.0 : 6.5}
            emissive={isDark ? "#180600" : "#0c0300"}
            emissiveIntensity={isDark ? 0.12 : 0.04}
            sheen={0.10} sheenColor="#4a1410"
            iridescence={0.08} iridescenceIOR={1.4} />
        </mesh>
        {/* Barrel crown — slight crown bulge, ultra-glossy */}
        <mesh position={[0, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.636, 0.636, 1.2, 128]} />
          <meshPhysicalMaterial
            color={isDark ? "#030100" : "#080200"}
            roughness={isDark ? 0.018 : 0.055}
            metalness={isDark ? 0.78 : 0.52}
            clearcoat={1.0} clearcoatRoughness={0.005}
            envMapIntensity={isDark ? 14.0 : 7.5}
            emissive={isDark ? "#1e0800" : "#100300"}
            emissiveIntensity={isDark ? 0.10 : 0.03} />
        </mesh>

        {/* Left bevel — 4-step chamfer for ultra-smooth taper */}
        <mesh position={[-1.52, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.600, 0.628, 0.14, 96]} />
          <meshPhysicalMaterial color="#0c0502" roughness={0.12} metalness={0.40}
            clearcoat={1.0} clearcoatRoughness={0.02} envMapIntensity={5.0} />
        </mesh>
        <mesh position={[-1.645, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.540, 0.600, 0.13, 96]} />
          <meshPhysicalMaterial color="#0a0402" roughness={0.15} metalness={0.32}
            clearcoat={0.98} clearcoatRoughness={0.03} envMapIntensity={4.0} />
        </mesh>
        <mesh position={[-1.760, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.468, 0.540, 0.115, 96]} />
          <meshPhysicalMaterial color="#080302" roughness={0.18} metalness={0.24}
            clearcoat={0.95} clearcoatRoughness={0.04} envMapIntensity={3.2} />
        </mesh>
        <mesh position={[-1.866, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.420, 0.468, 0.095, 96]} />
          <meshPhysicalMaterial color="#060202" roughness={0.22} metalness={0.18}
            clearcoat={0.92} clearcoatRoughness={0.05} envMapIntensity={2.5} />
        </mesh>

        {/* Right bevel — 4-step chamfer */}
        <mesh position={[1.52, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.600, 0.628, 0.14, 96]} />
          <meshPhysicalMaterial color="#0c0502" roughness={0.12} metalness={0.40}
            clearcoat={1.0} clearcoatRoughness={0.02} envMapIntensity={5.0} />
        </mesh>
        <mesh position={[1.645, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.540, 0.600, 0.13, 96]} />
          <meshPhysicalMaterial color="#0a0402" roughness={0.15} metalness={0.32}
            clearcoat={0.98} clearcoatRoughness={0.03} envMapIntensity={4.0} />
        </mesh>
        <mesh position={[1.760, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.468, 0.540, 0.115, 96]} />
          <meshPhysicalMaterial color="#080302" roughness={0.18} metalness={0.24}
            clearcoat={0.95} clearcoatRoughness={0.04} envMapIntensity={3.2} />
        </mesh>
        <mesh position={[1.866, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.420, 0.468, 0.095, 96]} />
          <meshPhysicalMaterial color="#060202" roughness={0.22} metalness={0.18}
            clearcoat={0.92} clearcoatRoughness={0.05} envMapIntensity={2.5} />
        </mesh>

        {/* Gold accent rings — thicker, richer, more prominent */}
        {[-1.36, -0.88, -0.44, 0.0, 0.44, 0.88, 1.36].map((x, i) => (
          <mesh key={i} position={[x, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.640, 0.640, i === 3 ? 0.24 : 0.062, 96]} />
            <meshPhysicalMaterial
              color={i === 3 ? '#F0D848' : '#D4A030'}
              roughness={i === 3 ? 0.016 : 0.030}
              metalness={1.0}
              envMapIntensity={i === 3 ? 8.0 : 5.5}
              emissive={i === 3 ? '#E0B820' : '#C9A030'}
              emissiveIntensity={i === 3 ? 0.14 : 0.06}
              clearcoat={1.0}
              clearcoatRoughness={0.008}
              anisotropy={1.0}
              anisotropyRotation={Math.PI / 2}
              iridescence={0.15} iridescenceIOR={1.5}
            />
          </mesh>
        ))}

        {/* Smooth flat end caps — no decorative circles, clean machined finish */}
        {[-1.928, 1.928].map((x, i) => (
          <mesh key={i} position={[x, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.418, 0.418, 0.008, 96]} />
            <meshPhysicalMaterial color={isDark ? "#060200" : "#0a0300"} roughness={0.05}
              metalness={0.85} clearcoat={1.0} clearcoatRoughness={0.008}
              envMapIntensity={isDark ? 6.0 : 3.2}
              emissive={isDark ? "#1a0600" : "#080200"} emissiveIntensity={isDark ? 0.06 : 0.01} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

/* ─────────────────────────────────────────────
   SCROLL / DOCUMENT PROP
───────────────────────────────────────────── */
function DocumentScroll() {
  return (
    <group position={[1.8, -4.55, 0.5]} rotation={[0.08, -0.3, 0.05]}>
      {/* Paper roll */}
      <mesh castShadow>
        <cylinderGeometry args={[0.055, 0.055, 1.1, 20]} />
        <meshPhysicalMaterial color="#f4efe2" roughness={0.85} metalness={0.0} clearcoat={0.1} />
      </mesh>
      {/* Gold seal caps */}
      {[-0.56, 0.56].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.02, 20]} />
          <meshPhysicalMaterial {...GOLD} clearcoat={0.9} />
        </mesh>
      ))}
      {/* Unrolled paper face */}
      <mesh position={[0, 0.1, 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.62, 0.9]} />
        <meshPhysicalMaterial color="#f8f4ea" roughness={0.9} metalness={0.0}
          clearcoat={0.05} side={THREE.DoubleSide} />
      </mesh>
      {/* Paper lines */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[0, -0.28 + i * 0.09, 0.065]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.44, 0.007]} />
          <meshPhysicalMaterial color="#c8c0a8" roughness={1.0} metalness={0.0}
            side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Red wax seal */}
      <mesh position={[0.08, -0.32, 0.067]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.055, 20]} />
        <meshPhysicalMaterial color="#8b1a1a" roughness={0.4} metalness={0.0}
          clearcoat={0.6} clearcoatRoughness={0.15} emissive="#6a1010" emissiveIntensity={0.05} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────
   FULL SCENE
───────────────────────────────────────────── */
function GavelScene({ onStrikeComplete, isMobile, isDark }) {
  const gavelRef = useRef(null);
  const rippleRef = useRef(null);
  const sceneRef = useRef(null);
  const [isStriking, setIsStriking] = useState(false);

  useFrame(({ mouse, clock }) => {
    if (sceneRef.current) {
      const lerpSpeed = isMobile ? 0.022 : 0.014;
      sceneRef.current.rotation.y = THREE.MathUtils.lerp(
        sceneRef.current.rotation.y, (mouse.x * Math.PI) / 24, lerpSpeed);
      sceneRef.current.rotation.x = THREE.MathUtils.lerp(
        sceneRef.current.rotation.x, (-mouse.y * Math.PI) / 48, lerpSpeed);
    }
    if (gavelRef.current && !isStriking) {
      gavelRef.current.rotation.y += 0.0008;
      gavelRef.current.position.y = -0.5 + Math.sin(clock.getElapsedTime() * 0.38) * 0.032;
    }
  });

  const handleStrike = useCallback(() => {
    if (isStriking || !gavelRef.current || !rippleRef.current) return;
    setIsStriking(true);
    const gavel = gavelRef.current;
    const ripple = rippleRef.current;

    const tl = gsap.timeline({ onComplete: () => { setIsStriking(false); onStrikeComplete(); } });
    tl.to(gavel.rotation, { z: -1.25, x: -0.12, duration: 0.18, ease: 'power3.in' });
    tl.to(gavel.rotation, { z: 0.18, x: 0.75, duration: 0.19, ease: 'power4.in' });
    tl.to(gavel.position, { y: -1.18, duration: 0.19, ease: 'power4.in' }, '<');
    tl.add(() => {
      ripple.scale.set(0.04, 0.04, 0.04);
      ripple.material.opacity = 0.95;
      gsap.to(ripple.scale, { x: 14, y: 14, z: 14, duration: 1.8, ease: 'power2.out' });
      gsap.to(ripple.material, { opacity: 0, duration: 1.8, ease: 'power2.out' });
      [
        [55, 'translate(4px,4px)'],
        [110, 'translate(-4px,-3px)'],
        [165, 'translate(3px,-3px)'],
        [220, 'translate(-2px,2px)'],
        [275, 'translate(0,0)'],
      ].forEach(([t, v]) => setTimeout(() => { document.body.style.transform = v; }, t));
    }, '-=0.02');
    tl.to(gavel.rotation, { z: -0.72, x: 0.15, duration: 1.5, ease: 'elastic.out(1,0.3)' }, '+=0.05');
    tl.to(gavel.position, { y: -0.5, duration: 1.2, ease: 'elastic.out(1,0.38)' }, '<');
  }, [isStriking, onStrikeComplete]);

  useEffect(() => {
    window.triggerGavelStrike = handleStrike;
  }, [handleStrike]);

  return (
    <group ref={sceneRef}>
      <CinematicCamera isMobile={isMobile} />

      {/* ── Lighting ── warm courtroom | dark: premium gold-lit luxury ── */}
      <ambientLight intensity={isDark ? 0.38 : (isMobile ? 0.55 : 0.22)} color={isDark ? "#c8a840" : "#fff4e0"} />
      {/* Main key — warm chandelier | dark: warm gold fill */}
      <directionalLight position={[5, 22, 12]} intensity={isDark ? 2.8 : (isMobile ? 3.2 : 4.8)} color={isDark ? "#f0d890" : "#fff6ee"}
        castShadow={!isMobile}
        shadow-mapSize={[4096, 4096]}
        shadow-camera-near={0.5} shadow-camera-far={65}
        shadow-camera-left={-20} shadow-camera-right={20}
        shadow-camera-top={20} shadow-camera-bottom={-20}
        shadow-bias={-0.00018} shadow-normalBias={0.016} />
      {/* Fill from left — warm gold */}
      <directionalLight position={[-10, 12, 7]} intensity={isDark ? 2.2 : (isMobile ? 1.1 : 2.0)} color={isDark ? "#D4AF37" : "#c8d8ff"} />
      {/* Back rim — gold accent */}
      <directionalLight position={[0, 8, -12]} intensity={isDark ? 1.4 : (isMobile ? 0.6 : 1.6)} color={isDark ? "#FFD700" : "#e0c8a0"} />
      {!isMobile && <>
        {/* Dramatic spot — burgundy in light | warm gold in dark */}
        <spotLight position={[-18, 16, 10]} intensity={isDark ? 7.0 : 8.0} color={isDark ? "#D4AF37" : "#7C1D2B"} angle={0.28} penumbra={0.85} castShadow />
        {/* Gold under-fill — strong gold glow on all models */}
        <pointLight position={[0.3, -3.5, 2.8]} intensity={isDark ? 8.5 : 2.8} color="#D4AF37" distance={22} decay={1.6} />
        {/* Side fill — warm amber both modes */}
        <pointLight position={[6, 1.0, 6]} intensity={isDark ? 3.5 : 2.2} color={isDark ? "#D4A83A" : "#ff9040"} distance={28} decay={2} />
        {/* Overhead accent — gold */}
        <pointLight position={[0, 14, -2]} intensity={isDark ? 3.5 : 2.4} color={isDark ? "#C9A84C" : "#c0c8f8"} distance={42} decay={1.4} />
        {/* Wide fill — gold wash */}
        <pointLight position={[10, 5, 5]} intensity={isDark ? 2.0 : 1.4} color={isDark ? "#D4AF37" : "#f8e8d0"} distance={26} decay={2} />
        {/* Books spotlight — gold */}
        <pointLight position={[3.4, -2.8, 2.5]} intensity={isDark ? 4.5 : 1.8} color="#D4AF37" distance={14} decay={2.0} />
        {/* Scales shimmer — gold */}
        <pointLight position={[-3.2, -1.0, 3.0]} intensity={isDark ? 5.5 : 2.0} color="#FFD700" distance={16} decay={1.8} />
        {isDark && <>
          {/* Extra dark-mode gold rim — every model surface catches gold */}
          <pointLight position={[0, -2, 5]} intensity={6.5} color="#FFD700" distance={22} decay={1.4} />
          <pointLight position={[0, 10, 0]} intensity={3.0} color="#D4AF37" distance={32} decay={1.8} />
          <pointLight position={[-6, -1, 4]} intensity={3.0} color="#C9A84C" distance={20} decay={2} />
          <pointLight position={[6, -1, 4]} intensity={3.0} color="#C9A84C" distance={20} decay={2} />
        </>}
      </>}
      {/* Gavel hero light — premium gold spotlight */}
      <pointLight position={[0.5, 2.5, 6.0]} intensity={isDark ? 12.0 : (isMobile ? 3.5 : 5.5)} color="#D4A83A" distance={26} decay={1.7} />
      <pointLight position={[-3.2, -3.0, 2.0]} intensity={isDark ? 4.5 : (isMobile ? 1.2 : 1.8)} color={isDark ? "#D4AF37" : "#ffb84a"} distance={14} decay={2.2} />

      <Environment preset={isDark ? "night" : "warehouse"} background={false} />
      <BackWall isDark={isDark} />
      <MarbleFloor isDark={isDark} />

      {/* ── Full courtroom — all assets visible immediately on load ── */}
      <group>
        <Pillars />
      </group>

      <group>
        <JudgeBench />
        <SoundBlock />
      </group>

      <group>
        <ScalesOfJustice />
      </group>

      <group>
        <LawBooks />
        <DocumentScroll />
        <Candles />
      </group>

      {/* Gavel — hero of the scene */}
      <group>
        <GavelMesh gavelRef={gavelRef} onStrike={handleStrike} isDark={isDark} />
      </group>

      {/* Strike ripple */}
      <mesh ref={rippleRef} position={[0.3, -4.52, 0.28]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.15, 80]} />
        <meshBasicMaterial color="#C9A84C" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      <Sparkles
        count={isMobile ? 55 : 320} scale={isMobile ? 16 : 24}
        size={isMobile ? 1.0 : 1.6} speed={isMobile ? 0.06 : 0.12}
        color={isDark ? "#FFD700" : "#D4A83A"} opacity={isDark ? 0.55 : 0.28} />
      {!isMobile && <>
        <Sparkles count={100} scale={14} size={0.7} speed={0.05} color={isDark ? "#D4AF37" : "#ffffff"} opacity={isDark ? 0.25 : 0.12} />
        <ContactShadows position={[0, -5.14, 0]} opacity={0.88} scale={44} blur={3.8} far={14} color="#120602" />
      </>}
    </group>
  );
}

function StaticHeroBackground() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-96 h-96 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #C9A84C 0%, #7C1D2B 50%, transparent 100%)', filter: 'blur(80px)' }} />
    </div>
  );
}

export default function HeroSection() {
  const { isDark } = useTheme();
  const [isStruck, setIsStruck] = useState(false);
  const [webglLost, setWebglLost] = useState(false);
  const isMobile = useMemo(() => typeof window !== 'undefined' && window.innerWidth < 768, []);

  const slowScrollToFeatures = useCallback(() => {
    const target = document.getElementById('features');
    if (!target) return;
    const startY = window.scrollY;
    const endY = target.getBoundingClientRect().top + window.scrollY;
    const dur = 900;
    let start;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      window.scrollTo(0, startY + (endY - startY) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  const handleStrikeComplete = useCallback(() => {
    setIsStruck(true);
    setTimeout(slowScrollToFeatures, 900);
  }, [slowScrollToFeatures]);

  const triggerStrike = () => {
    if (window.triggerGavelStrike) window.triggerGavelStrike();
    else handleStrikeComplete();
  };

  /* Silky expo-out curve — snappy start, smooth landing */
  const EASE_OUT = [0.16, 1, 0.3, 1];
  const EASE_IN  = [0.4, 0, 1, 1];

  const wordVariants = {
    hidden: { opacity: 0, y: 28, filter: 'blur(12px)' },
    visible: (i) => ({
      opacity: 1, y: 0, filter: 'blur(0px)',
      transition: { delay: i * 0.09, duration: 1.0, ease: EASE_OUT },
    }),
    dust: {
      opacity: 0, y: -50, filter: 'blur(24px)', scale: 1.03,
      transition: { duration: 1.1, ease: EASE_IN },
    },
  };

  return (
    <section id="hero" className="relative h-screen w-full overflow-hidden bg-transparent">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background z-[1] pointer-events-none" />

      <motion.div className="absolute inset-0 z-0"
        animate={isStruck
          ? { opacity: 0, filter: 'blur(6px)', transition: { duration: 1.6, ease: EASE_IN } }
          : { opacity: 1, filter: 'blur(0px)' }}>
        {checkWebGL() && !webglLost ? (
          <Canvas
            camera={{ position: [0, 6.5, isMobile ? 26 : 23], fov: isMobile ? 50 : 42 }}
            shadows={isMobile ? false : 'soft'}
            dpr={isMobile ? [0.75, 1.2] : [1, 2.5]}
            performance={{ min: 0.45 }}
            gl={{
              antialias: true,
              alpha: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: isDark ? 1.65 : (isMobile ? 1.15 : 1.32),
              powerPreference: 'high-performance',
              shadowMapType: THREE.PCFShadowMap,
            }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                setWebglLost(true);
              });
            }}>
            <GavelScene onStrikeComplete={handleStrikeComplete} isMobile={isMobile} isDark={isDark} />
          </Canvas>
        ) : (
          <StaticHeroBackground />
        )}
      </motion.div>

      <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-6 pointer-events-none">
        <div className="max-w-4xl mx-auto mt-16">
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
            {'Justice Powered by Intelligence'.split(' ').map((word, i) => (
              <motion.span key={i} custom={i} variants={wordVariants} initial="hidden"
                animate={isStruck ? 'dust' : 'visible'}
                className="inline-block mr-3 md:mr-4"
                style={{ textShadow: '0 2px 24px rgba(255,255,255,0.55)' }}>
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            className="text-xl md:text-2xl text-foreground/75 font-light mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={isStruck
              ? { opacity: 0, y: -40, filter: 'blur(16px)', transition: { duration: 0.9, ease: EASE_IN } }
              : { opacity: 1, y: 0, filter: 'blur(0px)', transition: { delay: 0.54, duration: 1.0, ease: EASE_OUT } }}>
            Gavel &amp; Brief — The Future of Legal Technology
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-6 pointer-events-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={isStruck
              ? { opacity: 0, y: -30, transition: { duration: 0.7, ease: EASE_IN } }
              : { opacity: 1, y: 0, transition: { delay: 0.7, duration: 0.9, ease: EASE_OUT } }}>
            <button onClick={triggerStrike}
              className="bg-primary text-primary-foreground px-9 py-4 rounded-sm font-semibold text-lg transition-all duration-500 hover:bg-primary/90 hover:shadow-2xl hover:shadow-primary/30 relative overflow-hidden group w-full sm:w-auto">
              <span className="relative z-10">Begin Experience</span>
              <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
            </button>
            <button
              className="border border-foreground/20 text-foreground px-9 py-4 rounded-sm font-semibold text-lg transition-all duration-500 hover:bg-foreground/5 hover:border-foreground/40 w-full sm:w-auto backdrop-blur-sm"
              onClick={() => { const s = document.getElementById('features'); if (s) s.scrollIntoView({ behavior: 'smooth' }); }}>
              Learn More
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
