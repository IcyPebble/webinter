function Packer(container) {
    this.container = container;
}

Packer.prototype.pack = function (blocks, max_width, sort = true) {
    blocks = structuredClone(blocks);

    // Pack groups
    for (let i = 0; i < blocks.length; i++) {
        let block = blocks[i];
        if (block.group) {
            packed_group = this.pack(block.blocks, max_width, block.sort);
            blocks[i].w = packed_group.root.w;
            blocks[i].h = packed_group.root.h;
            blocks[i].blocks = packed_group.blocks;
        }
    }

    // Sort blocks by width
    if (sort) {
        blocks.sort((a, b) => {
            let [aw, ah] = [Math.round(a.w), Math.round(a.h)];
            let [bw, bh] = [Math.round(b.w), Math.round(b.h)];

            return ((aw - bw) != 0) ? bw - aw : bh - ah;
        });
    }

    if (blocks[0].w > max_width) {
        throw new RangeError(`Element [id = ${blocks[0].id}] exceeds max_width (${max_width})`);
    }

    // Place first block at top-left corner(0, 0)
    blocks[0].x = 0;
    blocks[0].y = 0;
    let root = {
        "w": blocks[0].w, "h": blocks[0].h,
        "filled_area": blocks[0].w * blocks[0].h,
        "fit": 1
    };
    let p = [];

    if (blocks.length == 1) {
        return { "blocks": blocks, "root": root };
    }

    // Place remaining blocks
    for (let i = 0; i < blocks.length - 1; i++) {
        let bl = blocks[i];
        if (bl.w > max_width) {
            throw new RangeError(`Element [id = ${bl.id}] exceeds max_width (${max_width})`);
        }

        // Add top-right and bottom-left corner to positions
        p.push(
            { "x": bl.x + bl.w, "y": bl.y },
            { "x": bl.x, "y": bl.y + bl.h }
        );
        let next_bl = blocks[i + 1];

        // Prefer most top-left position
        p.sort((a, b) => (a.y != b.y) ? a.y - b.y : a.x - b.x);

        // Find best position for next block
        let best_score = Infinity;
        let best_pos;
        let best_pos_idx;
        for (let idx = 0; idx < p.length; idx++) {
            let pos = p[idx];

            // Check if block would overlap
            let overlap = false;
            for (let j = 0; j < blocks.length; j++) {
                let blk = blocks[j];

                let left1 = pos.x;
                let left2 = blk.x;
                let right1 = left1 + next_bl.w;
                let right2 = left2 + blk.w;

                let top1 = pos.y;
                let top2 = blk.y;
                let bottom1 = top1 + next_bl.h;
                let bottom2 = top2 + blk.h;

                if (left1 < right2 && right1 > left2 && top1 < bottom2 && bottom1 > top2) {
                    overlap = true;
                    break;
                }
            }

            // Skip position if overlap
            if (overlap) {
                continue;
            }

            // Calculate change of root
            let new_root_w = Math.max(root.w, pos.x + next_bl.w);
            let new_root_h = Math.max(root.h, pos.y + next_bl.h);
            let new_root_area = new_root_w * new_root_h;
            let new_root_f_area = root.filled_area + next_bl.w * next_bl.h;
            let new_root_fit = new_root_f_area / new_root_area;

            let root_fit = (1 - new_root_fit);
            let height_increase = new_root_h / root.h - 1;

            if (new_root_w > max_width) {
                continue;
            }

            // Score based on keeping <height_increase> low and <fit> high
            let score = Math.sqrt(height_increase ** 2 + root_fit ** 2);
            if (score < best_score) {
                best_pos = pos;
                best_pos_idx = idx;
                best_score = score;
            }
        }

        // Set new values
        next_bl.x = best_pos.x;
        next_bl.y = best_pos.y;
        root.w = Math.max(root.w, best_pos.x + next_bl.w);
        root.h = Math.max(root.h, best_pos.y + next_bl.h);
        root.filled_area += next_bl.w * next_bl.h;
        root.fit = root.filled_area / (root.w * root.h);

        // Remove selected position from possible positions
        p.splice(best_pos_idx, 1);
    }
    return { "blocks": blocks, "root": root };
};

Packer.prototype.elements_to_blocks = function (elements) {
    let blocks = [];
    [...elements].forEach((element) => {
        if (element.style.display == "none") { return } // ignore non-visible element
        if (element.classList.contains("group")) {
            if (!element.children.length) { return } // ignore empty groups
            blocks.push({
                "group": true,
                "blocks": this.elements_to_blocks(element.children),
                "id": element.id,
                "sort": element.hasAttribute("sort")
            });
        } else {
            let style = window.getComputedStyle(element);
            blocks.push({
                "w": parseFloat(style.getPropertyValue("width")),
                "h": parseFloat(style.getPropertyValue("height")),
                "id": element.id
            });
        }
    });
    return blocks;
};

Packer.prototype.place_blocks = function (blocks) {
    blocks.forEach((block) => {
        let element = document.getElementById(block.id);
        element.style.left = block.x + "px";
        element.style.top = block.y + "px";

        if (block.group) {
            element.style.width = block.w + "px";
            element.style.height = block.h + "px";
            this.place_blocks(block.blocks);
        }
    });
};

Packer.prototype.fit = function () {
    if (!this.container.children.length) { return 0 }
    let elements = [];
    for (child of this.container.children) {
        if (window.getComputedStyle(child).display != "none") {
            elements.push(child);
        }
    }
    if (!elements.length) { return 0 }

    let container_style = window.getComputedStyle(this.container);
    let max_width = window.innerWidth * (
        parseFloat(container_style.getPropertyValue("--max-content-width")) / 100
    );
    let blocks = this.elements_to_blocks(elements);
    let arrangement = this.pack(blocks, max_width, this.container.hasAttribute("sort"));

    this.container.style.width = arrangement.root.w + "px";
    this.container.style.height = arrangement.root.h + "px";

    this.place_blocks(arrangement.blocks);

    return arrangement.root.fit;
}