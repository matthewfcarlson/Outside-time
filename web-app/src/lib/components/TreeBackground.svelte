<script lang="ts">
  // Animated tree background - gentle swaying forest silhouettes
</script>

<div class="tree-bg" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice">
    <!-- Ground -->
    <ellipse cx="600" cy="810" rx="700" ry="60" fill="#c8dcc0" opacity="0.5" />

    <!-- Back row of trees (smaller, lighter, slower sway) -->
    <g class="tree back-tree" style="--sway-amount: 1.2deg; --sway-duration: 7s; transform-origin: 120px 800px;">
      <rect x="115" y="520" width="10" height="280" rx="3" fill="#5a7a52" opacity="0.35" />
      <ellipse cx="120" cy="480" rx="40" ry="70" fill="#6b8f5e" opacity="0.3" />
      <ellipse cx="120" cy="520" rx="35" ry="55" fill="#5a7a52" opacity="0.3" />
    </g>

    <g class="tree back-tree" style="--sway-amount: -1deg; --sway-duration: 8s; transform-origin: 350px 800px;">
      <rect x="345" y="500" width="10" height="300" rx="3" fill="#5a7a52" opacity="0.35" />
      <ellipse cx="350" cy="450" rx="45" ry="80" fill="#6b8f5e" opacity="0.3" />
      <ellipse cx="350" cy="500" rx="38" ry="60" fill="#5a7a52" opacity="0.3" />
    </g>

    <g class="tree back-tree" style="--sway-amount: 0.8deg; --sway-duration: 9s; transform-origin: 700px 800px;">
      <rect x="695" y="530" width="10" height="270" rx="3" fill="#5a7a52" opacity="0.35" />
      <ellipse cx="700" cy="490" rx="38" ry="65" fill="#6b8f5e" opacity="0.3" />
      <ellipse cx="700" cy="530" rx="32" ry="50" fill="#5a7a52" opacity="0.3" />
    </g>

    <g class="tree back-tree" style="--sway-amount: -1.1deg; --sway-duration: 7.5s; transform-origin: 950px 800px;">
      <rect x="945" y="510" width="10" height="290" rx="3" fill="#5a7a52" opacity="0.35" />
      <ellipse cx="950" cy="460" rx="42" ry="75" fill="#6b8f5e" opacity="0.3" />
      <ellipse cx="950" cy="510" rx="36" ry="58" fill="#5a7a52" opacity="0.3" />
    </g>

    <g class="tree back-tree" style="--sway-amount: 0.9deg; --sway-duration: 8.5s; transform-origin: 1100px 800px;">
      <rect x="1095" y="540" width="10" height="260" rx="3" fill="#5a7a52" opacity="0.35" />
      <ellipse cx="1100" cy="500" rx="36" ry="60" fill="#6b8f5e" opacity="0.3" />
      <ellipse cx="1100" cy="535" rx="30" ry="48" fill="#5a7a52" opacity="0.3" />
    </g>

    <!-- Middle row of trees -->
    <g class="tree mid-tree" style="--sway-amount: 1.5deg; --sway-duration: 5.5s; transform-origin: 60px 800px;">
      <rect x="54" y="460" width="12" height="340" rx="4" fill="#4a6b42" opacity="0.45" />
      <ellipse cx="60" cy="400" rx="50" ry="90" fill="#5a8a4e" opacity="0.4" />
      <ellipse cx="60" cy="450" rx="42" ry="65" fill="#4a6b42" opacity="0.4" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: -1.3deg; --sway-duration: 6s; transform-origin: 250px 800px;">
      <rect x="244" y="440" width="12" height="360" rx="4" fill="#4a6b42" opacity="0.45" />
      <ellipse cx="250" cy="370" rx="55" ry="100" fill="#5a8a4e" opacity="0.4" />
      <ellipse cx="250" cy="430" rx="45" ry="70" fill="#4a6b42" opacity="0.4" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: 1.2deg; --sway-duration: 6.5s; transform-origin: 520px 800px;">
      <rect x="514" y="470" width="12" height="330" rx="4" fill="#4a6b42" opacity="0.45" />
      <ellipse cx="520" cy="410" rx="48" ry="85" fill="#5a8a4e" opacity="0.4" />
      <ellipse cx="520" cy="460" rx="40" ry="62" fill="#4a6b42" opacity="0.4" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: -1.4deg; --sway-duration: 5s; transform-origin: 830px 800px;">
      <rect x="824" y="450" width="12" height="350" rx="4" fill="#4a6b42" opacity="0.45" />
      <ellipse cx="830" cy="380" rx="52" ry="95" fill="#5a8a4e" opacity="0.4" />
      <ellipse cx="830" cy="440" rx="44" ry="68" fill="#4a6b42" opacity="0.4" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: 1.1deg; --sway-duration: 6.2s; transform-origin: 1050px 800px;">
      <rect x="1044" y="465" width="12" height="335" rx="4" fill="#4a6b42" opacity="0.45" />
      <ellipse cx="1050" cy="405" rx="46" ry="82" fill="#5a8a4e" opacity="0.4" />
      <ellipse cx="1050" cy="455" rx="38" ry="60" fill="#4a6b42" opacity="0.4" />
    </g>

    <!-- Front row of trees (larger, darker, more sway) -->
    <g class="tree front-tree" style="--sway-amount: 2deg; --sway-duration: 4s; transform-origin: 0px 800px;">
      <rect x="-6" y="380" width="16" height="420" rx="5" fill="#3a5a35" opacity="0.5" />
      <ellipse cx="2" cy="300" rx="60" ry="110" fill="#4a7a42" opacity="0.45" />
      <ellipse cx="2" cy="370" rx="50" ry="80" fill="#3a5a35" opacity="0.45" />
    </g>

    <g class="tree front-tree" style="--sway-amount: -1.8deg; --sway-duration: 4.5s; transform-origin: 180px 800px;">
      <rect x="174" y="400" width="14" height="400" rx="5" fill="#3a5a35" opacity="0.5" />
      <ellipse cx="180" cy="320" rx="58" ry="105" fill="#4a7a42" opacity="0.45" />
      <ellipse cx="180" cy="390" rx="48" ry="75" fill="#3a5a35" opacity="0.45" />
    </g>

    <g class="tree front-tree" style="--sway-amount: 1.6deg; --sway-duration: 4.8s; transform-origin: 450px 800px;">
      <rect x="444" y="410" width="14" height="390" rx="5" fill="#3a5a35" opacity="0.5" />
      <ellipse cx="450" cy="330" rx="55" ry="100" fill="#4a7a42" opacity="0.45" />
      <ellipse cx="450" cy="400" rx="46" ry="72" fill="#3a5a35" opacity="0.45" />
    </g>

    <g class="tree front-tree" style="--sway-amount: -2.1deg; --sway-duration: 4.2s; transform-origin: 650px 800px;">
      <rect x="644" y="390" width="14" height="410" rx="5" fill="#3a5a35" opacity="0.5" />
      <ellipse cx="650" cy="310" rx="56" ry="108" fill="#4a7a42" opacity="0.45" />
      <ellipse cx="650" cy="380" rx="47" ry="76" fill="#3a5a35" opacity="0.45" />
    </g>

    <g class="tree front-tree" style="--sway-amount: 1.9deg; --sway-duration: 4.6s; transform-origin: 900px 800px;">
      <rect x="894" y="395" width="14" height="405" rx="5" fill="#3a5a35" opacity="0.5" />
      <ellipse cx="900" cy="315" rx="54" ry="102" fill="#4a7a42" opacity="0.45" />
      <ellipse cx="900" cy="385" rx="45" ry="74" fill="#3a5a35" opacity="0.45" />
    </g>

    <g class="tree front-tree" style="--sway-amount: -1.7deg; --sway-duration: 5.1s; transform-origin: 1150px 800px;">
      <rect x="1144" y="405" width="14" height="395" rx="5" fill="#3a5a35" opacity="0.5" />
      <ellipse cx="1150" cy="325" rx="52" ry="98" fill="#4a7a42" opacity="0.45" />
      <ellipse cx="1150" cy="395" rx="44" ry="70" fill="#3a5a35" opacity="0.45" />
    </g>

    <!-- Floating leaves / wind particles -->
    <circle class="leaf leaf-1" cx="200" cy="300" r="3" fill="#6b8f5e" opacity="0.4" />
    <circle class="leaf leaf-2" cx="500" cy="200" r="2.5" fill="#5a8a4e" opacity="0.35" />
    <circle class="leaf leaf-3" cx="800" cy="350" r="3" fill="#4a7a42" opacity="0.3" />
    <circle class="leaf leaf-4" cx="1000" cy="250" r="2" fill="#6b8f5e" opacity="0.35" />
    <circle class="leaf leaf-5" cx="350" cy="150" r="2.5" fill="#5a8a4e" opacity="0.3" />
  </svg>
</div>

<style>
  .tree-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .tree-bg svg {
    width: 100%;
    height: 100%;
    min-height: 100vh;
  }

  /* Tree sway animation using CSS custom properties */
  .tree {
    animation: sway var(--sway-duration, 5s) ease-in-out infinite;
    --sway: var(--sway-amount, 1deg);
  }

  @keyframes sway {
    0%, 100% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(var(--sway));
    }
    75% {
      transform: rotate(calc(var(--sway) * -0.6));
    }
  }

  /* Floating leaf animations */
  .leaf {
    animation: float-leaf 12s ease-in-out infinite;
  }

  .leaf-1 { animation-duration: 10s; animation-delay: 0s; }
  .leaf-2 { animation-duration: 13s; animation-delay: -3s; }
  .leaf-3 { animation-duration: 11s; animation-delay: -6s; }
  .leaf-4 { animation-duration: 14s; animation-delay: -2s; }
  .leaf-5 { animation-duration: 9s; animation-delay: -5s; }

  @keyframes float-leaf {
    0%, 100% {
      transform: translate(0, 0) scale(1);
      opacity: 0.35;
    }
    25% {
      transform: translate(30px, -20px) scale(1.2);
      opacity: 0.5;
    }
    50% {
      transform: translate(60px, 10px) scale(0.8);
      opacity: 0.25;
    }
    75% {
      transform: translate(20px, -10px) scale(1.1);
      opacity: 0.4;
    }
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .tree, .leaf {
      animation: none;
    }
  }
</style>
