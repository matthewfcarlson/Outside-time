<script lang="ts">
  // Animated pine tree background - gentle swaying forest silhouettes
</script>

<div class="tree-bg" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice">
    <!-- Ground -->
    <ellipse cx="600" cy="810" rx="700" ry="60" fill="#c5cfc2" opacity="0.3" />

    <!-- Back row of pine trees (smaller, lighter, slower sway) -->
    <g class="tree back-tree" style="--sway-amount: 1.2deg; --sway-duration: 7s; transform-origin: 120px 800px;">
      <rect x="117" y="560" width="6" height="240" rx="2" fill="#8a9886" opacity="0.25" />
      <polygon points="120,440 155,580 85,580" fill="#99a896" opacity="0.2" />
      <polygon points="120,480 150,570 90,570" fill="#8a9886" opacity="0.2" />
      <polygon points="120,510 145,560 95,560" fill="#8a9886" opacity="0.2" />
    </g>

    <g class="tree back-tree" style="--sway-amount: -1deg; --sway-duration: 8s; transform-origin: 350px 800px;">
      <rect x="347" y="540" width="6" height="260" rx="2" fill="#8a9886" opacity="0.25" />
      <polygon points="350,400 390,560 310,560" fill="#99a896" opacity="0.2" />
      <polygon points="350,450 385,550 315,550" fill="#8a9886" opacity="0.2" />
      <polygon points="350,490 378,540 322,540" fill="#8a9886" opacity="0.2" />
    </g>

    <g class="tree back-tree" style="--sway-amount: 0.8deg; --sway-duration: 9s; transform-origin: 700px 800px;">
      <rect x="697" y="570" width="6" height="230" rx="2" fill="#8a9886" opacity="0.25" />
      <polygon points="700,460 732,580 668,580" fill="#99a896" opacity="0.2" />
      <polygon points="700,500 728,570 672,570" fill="#8a9886" opacity="0.2" />
      <polygon points="700,530 724,565 676,565" fill="#8a9886" opacity="0.2" />
    </g>

    <g class="tree back-tree" style="--sway-amount: -1.1deg; --sway-duration: 7.5s; transform-origin: 950px 800px;">
      <rect x="947" y="550" width="6" height="250" rx="2" fill="#8a9886" opacity="0.25" />
      <polygon points="950,420 988,570 912,570" fill="#99a896" opacity="0.2" />
      <polygon points="950,465 982,560 918,560" fill="#8a9886" opacity="0.2" />
      <polygon points="950,500 976,550 924,550" fill="#8a9886" opacity="0.2" />
    </g>

    <g class="tree back-tree" style="--sway-amount: 0.9deg; --sway-duration: 8.5s; transform-origin: 1100px 800px;">
      <rect x="1097" y="575" width="6" height="225" rx="2" fill="#8a9886" opacity="0.25" />
      <polygon points="1100,470 1130,585 1070,585" fill="#99a896" opacity="0.2" />
      <polygon points="1100,510 1126,575 1074,575" fill="#8a9886" opacity="0.2" />
      <polygon points="1100,540 1122,570 1078,570" fill="#8a9886" opacity="0.2" />
    </g>

    <!-- Middle row of pine trees -->
    <g class="tree mid-tree" style="--sway-amount: 1.5deg; --sway-duration: 5.5s; transform-origin: 60px 800px;">
      <rect x="56" y="500" width="8" height="300" rx="3" fill="#7a8e76" opacity="0.3" />
      <polygon points="60,340 105,520 15,520" fill="#8fa88a" opacity="0.25" />
      <polygon points="60,400 100,510 20,510" fill="#7a8e76" opacity="0.25" />
      <polygon points="60,445 94,500 26,500" fill="#7a8e76" opacity="0.25" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: -1.3deg; --sway-duration: 6s; transform-origin: 250px 800px;">
      <rect x="246" y="480" width="8" height="320" rx="3" fill="#7a8e76" opacity="0.3" />
      <polygon points="250,310 300,500 200,500" fill="#8fa88a" opacity="0.25" />
      <polygon points="250,375 295,490 205,490" fill="#7a8e76" opacity="0.25" />
      <polygon points="250,425 288,480 212,480" fill="#7a8e76" opacity="0.25" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: 1.2deg; --sway-duration: 6.5s; transform-origin: 520px 800px;">
      <rect x="516" y="510" width="8" height="290" rx="3" fill="#7a8e76" opacity="0.3" />
      <polygon points="520,360 565,520 475,520" fill="#8fa88a" opacity="0.25" />
      <polygon points="520,415 560,510 480,510" fill="#7a8e76" opacity="0.25" />
      <polygon points="520,455 554,505 486,505" fill="#7a8e76" opacity="0.25" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: -1.4deg; --sway-duration: 5s; transform-origin: 830px 800px;">
      <rect x="826" y="490" width="8" height="310" rx="3" fill="#7a8e76" opacity="0.3" />
      <polygon points="830,320 878,510 782,510" fill="#8fa88a" opacity="0.25" />
      <polygon points="830,385 873,500 787,500" fill="#7a8e76" opacity="0.25" />
      <polygon points="830,430 866,490 794,490" fill="#7a8e76" opacity="0.25" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: 1.1deg; --sway-duration: 6.2s; transform-origin: 1050px 800px;">
      <rect x="1046" y="505" width="8" height="295" rx="3" fill="#7a8e76" opacity="0.3" />
      <polygon points="1050,355 1093,515 1007,515" fill="#8fa88a" opacity="0.25" />
      <polygon points="1050,410 1088,505 1012,505" fill="#7a8e76" opacity="0.25" />
      <polygon points="1050,450 1082,500 1018,500" fill="#7a8e76" opacity="0.25" />
    </g>

    <!-- Front row of pine trees (larger, slightly darker, more sway) -->
    <g class="tree front-tree" style="--sway-amount: 2deg; --sway-duration: 4s; transform-origin: 0px 800px;">
      <rect x="-4" y="420" width="10" height="380" rx="3" fill="#6b7f68" opacity="0.3" />
      <polygon points="2,240 62,440 -58,440" fill="#7d9478" opacity="0.28" />
      <polygon points="2,320 56,430 -52,430" fill="#6b7f68" opacity="0.28" />
      <polygon points="2,375 48,420 -44,420" fill="#6b7f68" opacity="0.28" />
    </g>

    <g class="tree front-tree" style="--sway-amount: -1.8deg; --sway-duration: 4.5s; transform-origin: 180px 800px;">
      <rect x="176" y="440" width="10" height="360" rx="3" fill="#6b7f68" opacity="0.3" />
      <polygon points="180,265 238,460 122,460" fill="#7d9478" opacity="0.28" />
      <polygon points="180,340 232,450 128,450" fill="#6b7f68" opacity="0.28" />
      <polygon points="180,390 224,440 136,440" fill="#6b7f68" opacity="0.28" />
    </g>

    <g class="tree front-tree" style="--sway-amount: 1.6deg; --sway-duration: 4.8s; transform-origin: 450px 800px;">
      <rect x="446" y="450" width="10" height="350" rx="3" fill="#6b7f68" opacity="0.3" />
      <polygon points="450,280 506,470 394,470" fill="#7d9478" opacity="0.28" />
      <polygon points="450,350 500,460 400,460" fill="#6b7f68" opacity="0.28" />
      <polygon points="450,400 492,450 408,450" fill="#6b7f68" opacity="0.28" />
    </g>

    <g class="tree front-tree" style="--sway-amount: -2.1deg; --sway-duration: 4.2s; transform-origin: 650px 800px;">
      <rect x="646" y="430" width="10" height="370" rx="3" fill="#6b7f68" opacity="0.3" />
      <polygon points="650,250 710,450 590,450" fill="#7d9478" opacity="0.28" />
      <polygon points="650,325 704,440 596,440" fill="#6b7f68" opacity="0.28" />
      <polygon points="650,380 696,430 604,430" fill="#6b7f68" opacity="0.28" />
    </g>

    <g class="tree front-tree" style="--sway-amount: 1.9deg; --sway-duration: 4.6s; transform-origin: 900px 800px;">
      <rect x="896" y="435" width="10" height="365" rx="3" fill="#6b7f68" opacity="0.3" />
      <polygon points="900,260 958,455 842,455" fill="#7d9478" opacity="0.28" />
      <polygon points="900,335 952,445 848,445" fill="#6b7f68" opacity="0.28" />
      <polygon points="900,385 944,435 856,435" fill="#6b7f68" opacity="0.28" />
    </g>

    <g class="tree front-tree" style="--sway-amount: -1.7deg; --sway-duration: 5.1s; transform-origin: 1150px 800px;">
      <rect x="1146" y="445" width="10" height="355" rx="3" fill="#6b7f68" opacity="0.3" />
      <polygon points="1150,275 1204,465 1096,465" fill="#7d9478" opacity="0.28" />
      <polygon points="1150,345 1198,455 1102,455" fill="#6b7f68" opacity="0.28" />
      <polygon points="1150,395 1190,445 1110,445" fill="#6b7f68" opacity="0.28" />
    </g>

    <!-- Floating particles / wind -->
    <circle class="leaf leaf-1" cx="200" cy="300" r="2" fill="#8fa88a" opacity="0.2" />
    <circle class="leaf leaf-2" cx="500" cy="200" r="1.5" fill="#8fa88a" opacity="0.18" />
    <circle class="leaf leaf-3" cx="800" cy="350" r="2" fill="#7d9478" opacity="0.15" />
    <circle class="leaf leaf-4" cx="1000" cy="250" r="1.5" fill="#8fa88a" opacity="0.18" />
    <circle class="leaf leaf-5" cx="350" cy="150" r="1.5" fill="#8fa88a" opacity="0.15" />
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
      opacity: 0.2;
    }
    25% {
      transform: translate(30px, -20px) scale(1.2);
      opacity: 0.3;
    }
    50% {
      transform: translate(60px, 10px) scale(0.8);
      opacity: 0.12;
    }
    75% {
      transform: translate(20px, -10px) scale(1.1);
      opacity: 0.25;
    }
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .tree, .leaf {
      animation: none;
    }
  }
</style>
