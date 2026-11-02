// Everything shown on the mountain is edited here.
//
// Source: UGCM1713 Mathematics for Engineering II lecture notes (Topics 1 to 4).
// Formulas were checked against the slides; `source` names where each one lives.
//
// x and y are percentages of the 1000 x 800 stage, so a point stays pinned to
// the same spot on the mountain at every screen size. Keep x between 18 and 82:
// narrow phones crop the far left and right of the mountain.
//
// Formula shorthand: _x or _{..} is a subscript, ^x or ^{..} is a superscript.

export interface KnowledgePoint {
  id: string;
  topic: string;
  title: string;
  description: string;
  formula?: string;
  source?: string;
  x: number;
  y: number;
}

const T1 = "Topic 1 · Calculus of Several Variables";
const T2 = "Topic 2 · Differential Equations & Series";
const T3 = "Topic 3 · Partial Differential Equations";
const T4 = "Topic 4 · Complex Numbers";

// Listed in lesson order. The light trail climbs the mountain in this order,
// from the first lesson at the foot to the last one near the summit.
export const knowledgePoints: KnowledgePoint[] = [
  {
    id: "quadric-surfaces",
    topic: T1,
    title: "Quadric Surfaces",
    description: "Ellipsoids, hyperboloids and paraboloids. The equation shown is the ellipsoid.",
    formula: "x^2/a^2 + y^2/b^2 + z^2/c^2 = 1",
    source: "Topic 1, Section 1.5",
    x: 23,
    y: 76,
  },
  {
    id: "gradient",
    topic: T1,
    title: "Gradient",
    description: "A vector built from a scalar field. The directional derivative along a unit vector comes from it.",
    formula: "∇f = (∂f/∂x)i + (∂f/∂y)j + (∂f/∂z)k",
    source: "Topic 1, Section 3.1",
    x: 37,
    y: 78,
  },
  {
    id: "divergence",
    topic: T1,
    title: "Divergence",
    description: "How much a vector field flows out of a small volume, per unit volume.",
    formula: "div F = ∇·F",
    source: "Topic 1, Section 4.1",
    x: 52,
    y: 76,
  },
  {
    id: "curl",
    topic: T1,
    title: "Curl",
    description: "A vector measuring the rotation about a point in a fluid.",
    formula: "curl F = ∇×F",
    source: "Topic 1, Section 4.2",
    x: 67,
    y: 77,
  },
  {
    id: "laplacian",
    topic: T1,
    title: "Laplacian",
    description: "The divergence of a gradient, and the operator behind the equations further up this mountain.",
    formula: "∇^2f = ∂^2f/∂x^2 + ∂^2f/∂y^2 + ∂^2f/∂z^2",
    source: "Topic 1, eq. 1.27",
    x: 79,
    y: 70,
  },
  {
    id: "greens-theorem",
    topic: T1,
    title: "Green's Theorem",
    description: "Relates a line integral around a closed curve to a double integral over the region it encloses.",
    formula: "∮_C (P dx + Q dy) = ∬_A (∂Q/∂x − ∂P/∂y) dx dy",
    source: "Topic 1, eq. 1.50",
    x: 66,
    y: 67,
  },
  {
    id: "stokes-theorem",
    topic: T1,
    title: "Stokes' Theorem",
    description: "The generalization of Green's theorem, relating line integrals in three dimensions to surface integrals.",
    formula: "∮_C F·dr = ∬_S (curl F)·dS",
    source: "Topic 1, eq. 1.51",
    x: 51,
    y: 66,
  },
  {
    id: "divergence-theorem",
    topic: T1,
    title: "Gauss's Divergence Theorem",
    description: "Relates the flow out through a closed surface to the volume integral of the divergence inside it.",
    formula: "∬_S F·dS = ∭_V div F dV",
    source: "Topic 1, Section 7.3",
    x: 36,
    y: 67,
  },
  {
    id: "characteristic-equation",
    topic: T2,
    title: "Second Order ODEs",
    description: "A constant-coefficient equation turns into an algebra problem: its roots decide the form of the solution.",
    formula: "ay″ + by′ + cy = 0  →  am^2 + bm + c = 0",
    source: "Topic 2, Section 1.1",
    x: 29,
    y: 58,
  },
  {
    id: "euler-equation",
    topic: T2,
    title: "Euler Equation",
    description: "A homogeneous equation with variable coefficients, solved by assuming y = xᵐ.",
    formula: "ax^2y″ + bxy′ + cy = 0",
    source: "Topic 2, eq. 2.9",
    x: 42,
    y: 57,
  },
  {
    id: "taylor-series",
    topic: T2,
    title: "Taylor Series",
    description: "A function represented as a sum of infinite terms, centred at a point x₀.",
    formula: "f(x) = ∑_{n=0}^{∞} f^{(n)}(x_0)(x − x_0)^n / n!",
    source: "Topic 2, eq. 2.21",
    x: 56,
    y: 57,
  },
  {
    id: "frobenius-method",
    topic: T2,
    title: "Frobenius Method",
    description: "A power series solution for use at a singular point of a differential equation.",
    formula: "y = x^r ∑_{n=0}^{∞} a_n x^n,   a_0 ≠ 0",
    source: "Topic 2, eq. 2.27a",
    x: 70,
    y: 58,
  },
  {
    id: "fourier-series",
    topic: T3,
    title: "Fourier Series",
    description: "A periodic function that satisfies certain conditions, written as a sum of sines and cosines.",
    formula: "f(x) = ½a_0 + ∑_{n=1}^{∞} (a_n cos nωx + b_n sin nωx)",
    source: "Topic 3, eq. 3.6",
    x: 62,
    y: 47,
  },
  {
    id: "half-range-series",
    topic: T3,
    title: "Half-Range Series",
    description: "Series for a function defined over a finite interval: a pure cosine series or a pure sine series.",
    source: "Topic 3, Section 2.2",
    x: 49,
    y: 46,
  },
  {
    id: "wave-equation",
    topic: T3,
    title: "Wave Equation",
    description: "Models a vibrating string, derived from the forces on a small piece of it.",
    formula: "∂^2u/∂t^2 = c^2 ∂^2u/∂x^2",
    source: "Topic 3, Section 4",
    x: 37,
    y: 48,
  },
  {
    id: "heat-equation",
    topic: T3,
    title: "Heat Equation",
    description: "Models heat flow along a bar. κ = k/cρ is the thermal diffusivity.",
    formula: "∂u/∂t = κ ∂^2u/∂x^2",
    source: "Topic 3, eq. 3.48",
    x: 44,
    y: 38,
  },
  {
    id: "laplace-equation",
    topic: T3,
    title: "Laplace Equation",
    description: "Steady-state heat flow, and the electrostatic potential in a uniform dielectric.",
    formula: "∂^2u/∂x^2 + ∂^2u/∂y^2 = 0",
    source: "Topic 3, eq. 3.63",
    x: 56,
    y: 38,
  },
  {
    id: "complex-forms",
    topic: T4,
    title: "Forms of a Complex Number",
    description: "One point on the Argand diagram, in Cartesian, trigonometric and exponential form.",
    formula: "z = a + bi = |z|(cos θ + i sin θ) = |z|e^{iθ}",
    source: "Topic 4, Section 4",
    x: 52,
    y: 31,
  },
  {
    id: "de-moivre",
    topic: T4,
    title: "De Moivre's Theorem",
    description: "Raises a complex number in polar form to a power: the modulus is powered, the argument multiplied.",
    formula: "(cos θ + i sin θ)^n = cos nθ + i sin nθ",
    source: "Topic 4, eq. 4.1",
    x: 50,
    y: 20,
  },
];

// Small formula fragments etched into the rock. Scattered automatically over
// the mountain, and they are what lifts away during the transformation.
export const surfaceGlyphs: string[] = [
  "∇f", "∇·F", "∇×F", "∇²f", "∮", "∬", "∭", "∂u/∂t", "∂²u/∂x²", "∑aₙxⁿ", "xʳ", "y″", "y′",
  "am²+bm+c", "f(x₀)", "n!", "½a₀", "cos nωx", "sin nωx", "κ", "c²", "ρ", "π", "2π/T",
  "eⁱᶿ", "|z|", "cos θ", "i sin θ", "z̄", "a+bi", "dS", "dV", "dr", "curl F", "div F",
];
