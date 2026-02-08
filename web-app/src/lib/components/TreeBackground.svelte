<script lang="ts">
  // Animated pine tree background - gentle swaying forest silhouettes
</script>

<div class="tree-bg" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice">
    <!-- Ground -->
    <ellipse cx="600" cy="810" rx="700" ry="60" fill="#c5cfc2" opacity="0.3" />

    <!-- Back row of pine trees (smaller, lighter, slower sway) -->
    <g class="tree back-tree" style="--sway-amount: 1.2deg; --sway-duration: 7s; transform-origin: 120px 800px;">
      <rect x="117" y="560" width="6" height="240" rx="2" fill="#b5c3b2" opacity="0.6" />
      <polygon points="120,490 155,580 85,580" fill="#c8d8c2" opacity="0.65" />
      <polygon points="120,435 150,535 90,535" fill="#c2d4bc" opacity="0.65" />
      <polygon points="120,380 145,485 95,485" fill="#c2d4bc" opacity="0.65" />
    </g>

    <g class="tree back-tree" style="--sway-amount: -1deg; --sway-duration: 8s; transform-origin: 350px 800px;">
      <rect x="347" y="540" width="6" height="260" rx="2" fill="#b5c3b2" opacity="0.6" />
      <polygon points="350,475 390,560 310,560" fill="#c8d8c2" opacity="0.65" />
      <polygon points="350,415 385,515 315,515" fill="#c2d4bc" opacity="0.65" />
      <polygon points="350,355 378,460 322,460" fill="#c2d4bc" opacity="0.65" />
    </g>

    <g class="tree back-tree" style="--sway-amount: 0.8deg; --sway-duration: 9s; transform-origin: 700px 800px;">
      <rect x="697" y="570" width="6" height="230" rx="2" fill="#b5c3b2" opacity="0.6" />
      <polygon points="700,510 732,580 668,580" fill="#c8d8c2" opacity="0.65" />
      <polygon points="700,460 728,545 672,545" fill="#c2d4bc" opacity="0.65" />
      <polygon points="700,415 724,500 676,500" fill="#c2d4bc" opacity="0.65" />
    </g>

    <g class="tree back-tree" style="--sway-amount: -1.1deg; --sway-duration: 7.5s; transform-origin: 950px 800px;">
      <rect x="947" y="550" width="6" height="250" rx="2" fill="#b5c3b2" opacity="0.6" />
      <polygon points="950,485 988,570 912,570" fill="#c8d8c2" opacity="0.65" />
      <polygon points="950,425 982,525 918,525" fill="#c2d4bc" opacity="0.65" />
      <polygon points="950,365 976,470 924,470" fill="#c2d4bc" opacity="0.65" />
    </g>

    <g class="tree back-tree" style="--sway-amount: 0.9deg; --sway-duration: 8.5s; transform-origin: 1100px 800px;">
      <rect x="1097" y="575" width="6" height="225" rx="2" fill="#b5c3b2" opacity="0.6" />
      <polygon points="1100,515 1130,585 1070,585" fill="#c8d8c2" opacity="0.65" />
      <polygon points="1100,465 1126,550 1074,550" fill="#c2d4bc" opacity="0.65" />
      <polygon points="1100,420 1122,505 1078,505" fill="#c2d4bc" opacity="0.65" />
    </g>

    <!-- Middle row of pine trees -->
    <g class="tree mid-tree" style="--sway-amount: 1.5deg; --sway-duration: 5.5s; transform-origin: 60px 800px;">
      <rect x="56" y="500" width="8" height="300" rx="3" fill="#a0b09d" opacity="0.65" />
      <polygon points="60,425 105,520 15,520" fill="#b8ccb3" opacity="0.7" />
      <polygon points="60,350 100,460 20,460" fill="#b0c4ab" opacity="0.7" />
      <polygon points="60,280 94,395 26,395" fill="#b0c4ab" opacity="0.7" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: -1.3deg; --sway-duration: 6s; transform-origin: 250px 800px;">
      <rect x="246" y="480" width="8" height="320" rx="3" fill="#a0b09d" opacity="0.65" />
      <polygon points="250,405 300,500 200,500" fill="#b8ccb3" opacity="0.7" />
      <polygon points="250,325 295,440 205,440" fill="#b0c4ab" opacity="0.7" />
      <polygon points="250,255 288,370 212,370" fill="#b0c4ab" opacity="0.7" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: 1.2deg; --sway-duration: 6.5s; transform-origin: 520px 800px;">
      <rect x="516" y="510" width="8" height="290" rx="3" fill="#a0b09d" opacity="0.65" />
      <polygon points="520,435 565,520 475,520" fill="#b8ccb3" opacity="0.7" />
      <polygon points="520,360 560,470 480,470" fill="#b0c4ab" opacity="0.7" />
      <polygon points="520,295 554,405 486,405" fill="#b0c4ab" opacity="0.7" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: -1.4deg; --sway-duration: 5s; transform-origin: 830px 800px;">
      <rect x="826" y="490" width="8" height="310" rx="3" fill="#a0b09d" opacity="0.65" />
      <polygon points="830,415 878,510 782,510" fill="#b8ccb3" opacity="0.7" />
      <polygon points="830,335 873,450 787,450" fill="#b0c4ab" opacity="0.7" />
      <polygon points="830,260 866,380 794,380" fill="#b0c4ab" opacity="0.7" />
    </g>

    <g class="tree mid-tree" style="--sway-amount: 1.1deg; --sway-duration: 6.2s; transform-origin: 1050px 800px;">
      <rect x="1046" y="505" width="8" height="295" rx="3" fill="#a0b09d" opacity="0.65" />
      <polygon points="1050,430 1093,515 1007,515" fill="#b8ccb3" opacity="0.7" />
      <polygon points="1050,355 1088,465 1012,465" fill="#b0c4ab" opacity="0.7" />
      <polygon points="1050,290 1082,400 1018,400" fill="#b0c4ab" opacity="0.7" />
    </g>

    <!-- Front row of pine trees (larger, slightly darker, more sway) -->
    <g class="tree front-tree" style="--sway-amount: 2deg; --sway-duration: 4s; transform-origin: 0px 800px;">
      <rect x="-4" y="420" width="10" height="380" rx="3" fill="#8fa08c" opacity="0.7" />
      <polygon points="2,340 62,440 -58,440" fill="#a8bda3" opacity="0.75" />
      <polygon points="2,250 56,370 -52,370" fill="#9eb598" opacity="0.75" />
      <polygon points="2,170 48,295 -44,295" fill="#9eb598" opacity="0.75" />
    </g>

    <g class="tree front-tree" style="--sway-amount: -1.8deg; --sway-duration: 4.5s; transform-origin: 180px 800px;">
      <rect x="176" y="440" width="10" height="360" rx="3" fill="#8fa08c" opacity="0.7" />
      <polygon points="180,360 238,460 122,460" fill="#a8bda3" opacity="0.75" />
      <polygon points="180,270 232,385 128,385" fill="#9eb598" opacity="0.75" />
      <polygon points="180,195 224,310 136,310" fill="#9eb598" opacity="0.75" />
    </g>

    <g class="tree front-tree" style="--sway-amount: 1.6deg; --sway-duration: 4.8s; transform-origin: 450px 800px;">
      <rect x="446" y="450" width="10" height="350" rx="3" fill="#8fa08c" opacity="0.7" />
      <polygon points="450,370 506,470 394,470" fill="#a8bda3" opacity="0.75" />
      <polygon points="450,280 500,395 400,395" fill="#9eb598" opacity="0.75" />
      <polygon points="450,205 492,320 408,320" fill="#9eb598" opacity="0.75" />
    </g>

    <g class="tree front-tree" style="--sway-amount: -2.1deg; --sway-duration: 4.2s; transform-origin: 650px 800px;">
      <rect x="646" y="430" width="10" height="370" rx="3" fill="#8fa08c" opacity="0.7" />
      <polygon points="650,350 710,450 590,450" fill="#a8bda3" opacity="0.75" />
      <polygon points="650,260 704,375 596,375" fill="#9eb598" opacity="0.75" />
      <polygon points="650,180 696,300 604,300" fill="#9eb598" opacity="0.75" />
    </g>

    <g class="tree front-tree" style="--sway-amount: 1.9deg; --sway-duration: 4.6s; transform-origin: 900px 800px;">
      <rect x="896" y="435" width="10" height="365" rx="3" fill="#8fa08c" opacity="0.7" />
      <polygon points="900,355 958,455 842,455" fill="#a8bda3" opacity="0.75" />
      <polygon points="900,265 952,380 848,380" fill="#9eb598" opacity="0.75" />
      <polygon points="900,185 944,305 856,305" fill="#9eb598" opacity="0.75" />
    </g>

    <g class="tree front-tree" style="--sway-amount: -1.7deg; --sway-duration: 5.1s; transform-origin: 1150px 800px;">
      <rect x="1146" y="445" width="10" height="355" rx="3" fill="#8fa08c" opacity="0.7" />
      <polygon points="1150,365 1204,465 1096,465" fill="#a8bda3" opacity="0.75" />
      <polygon points="1150,275 1198,390 1102,390" fill="#9eb598" opacity="0.75" />
      <polygon points="1150,200 1190,320 1110,320" fill="#9eb598" opacity="0.75" />
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
