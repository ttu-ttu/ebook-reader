/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import { randomize } from '$lib/functions/utils';

const confettiColors = [
  { front: '#3B870A', back: '#235106' },
  { front: '#B96300', back: '#6f3b00' },
  { front: '#E23D34', back: '#88251f' },
  { front: '#CD3168', back: '#7b1d3e' },
  { front: '#664E8B', back: '#3d2f53' },
  { front: '#394F78', back: '#222f48' },
  { front: '#008A8A', back: '#005353' }
];

export const confettiParams = {
  number: 70,
  size: { x: [5, 20], y: [10, 18] },
  initSpeed: 25,
  gravity: 0.65,
  drag: 0.08,
  terminalVelocity: 6,
  flipSpeed: 0.017
};

export class Confetti {
  private randomModifier = randomize(-1, 1);

  private colorPair = confettiColors[Math.floor(randomize(0, confettiColors.length))];

  private velocity = {
    x: randomize(-confettiParams.initSpeed, confettiParams.initSpeed) * 0.4,
    y: randomize(-confettiParams.initSpeed, confettiParams.initSpeed)
  };

  private flipSpeed = randomize(0.2, 1.5) * confettiParams.flipSpeed;

  private terminalVelocity = randomize(1, 1.5) * confettiParams.terminalVelocity;

  color = this.colorPair.front;

  dimensions = {
    x: randomize(confettiParams.size.x[0], confettiParams.size.x[1]),
    y: randomize(confettiParams.size.y[0], confettiParams.size.y[1])
  };

  position = {
    x: 0,
    y: 0
  };

  rotation = randomize(0, 2 * Math.PI);

  scale = { x: 1, y: 1 };

  constructor(position: number[], containerHeight: number) {
    this.position = {
      x: position[0],
      y: position[1]
    };

    if (this.position.y <= containerHeight) {
      this.velocity.y = -Math.abs(this.velocity.y);
    }
  }

  update() {
    this.velocity.x *= 0.98;
    this.position.x += this.velocity.x;
    this.velocity.y += this.randomModifier * confettiParams.drag;
    this.velocity.y += confettiParams.gravity;
    this.velocity.y = Math.min(this.velocity.y, this.terminalVelocity);
    this.position.y += this.velocity.y;
    this.scale.y = Math.cos((this.position.y + this.randomModifier) * this.flipSpeed);
    this.color = this.scale.y > 0 ? this.colorPair.front : this.colorPair.back;
  }
}
