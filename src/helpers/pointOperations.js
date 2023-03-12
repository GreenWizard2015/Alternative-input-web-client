export function add({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    return {
        x: x1 + x2,
        y: y1 + y2
    }
}

export function subtract({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    return {
        x: x1 - x2,
        y: y1 - y2
    }
}

export function normalize({ x, y }) {
    const dist = Math.sqrt(x ** 2 + y ** 2);
    if(dist === 0) return { x, y };
    return {
        x: x / dist,
        y: y / dist
    }
}

export function multipleScalar({ x, y }, z) {
    return {
        x: x * z,
        y: y * z
    }
}

export function addScalar({ x, y }, z) {
    return {
        x: x + z,
        y: y + z
    }
}

export function distance({ x, y }) {
    return Math.sqrt(x ** 2 + y ** 2);
}
