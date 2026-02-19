// 图片上传和颜色提取功能
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.querySelector('.upload-btn');
const previewSection = document.getElementById('preview-section');
const previewImage = document.getElementById('preview-image');
const paletteSection = document.getElementById('palette-section');
const colorPalette = document.getElementById('color-palette');
const canvas = document.getElementById('canvas');
const downloadBtn = document.getElementById('download-btn');
let extractedColors = [];

// 点击上传按钮
uploadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

// 点击拖放区域
dropZone.addEventListener('click', (e) => {
    if (e.target === dropZone || e.target.tagName === 'P') {
        fileInput.click();
    }
});

// 文件选择
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImage(file);
    }
});

// 拖放事件
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImage(file);
    }
});

// 处理图片
function handleImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewSection.style.display = 'block';

        // 图片加载完成后提取颜色
        previewImage.onload = () => {
            extractColors();
        };
    };
    reader.readAsDataURL(file);
}

// 提取颜色
function extractColors() {
    const ctx = canvas.getContext('2d');

    // 设置canvas尺寸
    const maxSize = 500;
    let width = previewImage.naturalWidth;
    let height = previewImage.naturalHeight;

    if (width > maxSize || height > maxSize) {
        if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
        } else {
            width = (width / height) * maxSize;
            height = maxSize;
        }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(previewImage, 0, 0, width, height);

    // 获取像素数据
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // 采样像素（为了性能，不是每个像素都采样）
    const sampledColors = [];
    const step = Math.max(1, Math.floor((width * height) / 5000));

    for (let i = 0; i < pixels.length; i += 4 * step) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // 只使用不透明像素
        if (a > 128) {
            sampledColors.push({ r, g, b });
        }
    }

    // 获取用户选择的模式
    const selectedMode = document.querySelector('input[name="color-mode"]:checked').value;
    const numColors = parseInt(selectedMode);

    // 根据模式提取颜色
    if (numColors === 50) {
        extractedColors = getAllUniqueColors(sampledColors, 50);
    } else {
        extractedColors = getDominantColors(sampledColors, numColors);
    }

    // 显示色卡
    displayPalette(extractedColors);
}

// 获取主色调（使用量化方法）
function getDominantColors(colors, numColors) {
    if (colors.length === 0) return [];

    // 简单的K-means聚类算法
    let centroids = [];
    const step = Math.floor(colors.length / (numColors * 10));

    // 初始化聚类中心
    for (let i = 0; i < numColors && i < colors.length; i++) {
        centroids.push(colors[i * step]);
    }

    const maxIterations = 10;
    for (let iter = 0; iter < maxIterations; iter++) {
        // 分配每个颜色到最近的聚类中心
        const clusters = new Array(numColors).fill(0).map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

        for (const color of colors) {
            let minDist = Infinity;
            let closestCentroid = 0;

            for (let i = 0; i < centroids.length; i++) {
                const dist = colorDistance(color, centroids[i]);
                if (dist < minDist) {
                    minDist = dist;
                    closestCentroid = i;
                }
            }

            clusters[closestCentroid].r += color.r;
            clusters[closestCentroid].g += color.g;
            clusters[closestCentroid].b += color.b;
            clusters[closestCentroid].count++;
        }

        // 更新聚类中心
        centroids = clusters.map(cluster => {
            if (cluster.count > 0) {
                return {
                    r: Math.round(cluster.r / cluster.count),
                    g: Math.round(cluster.g / cluster.count),
                    b: Math.round(cluster.b / cluster.count)
                };
            }
            return { r: 0, g: 0, b: 0 };
        });
    }

    // 计算每个聚类的颜色数量
    const colorCounts = new Array(numColors).fill(0);
    for (const color of colors) {
        let minDist = Infinity;
        let closestCentroid = 0;

        for (let i = 0; i < centroids.length; i++) {
            const dist = colorDistance(color, centroids[i]);
            if (dist < minDist) {
                minDist = dist;
                closestCentroid = i;
            }
        }
        colorCounts[closestCentroid]++;
    }

    // 按颜色数量排序
    const indexedColors = centroids.map((color, index) => ({
        ...color,
        count: colorCounts[index]
    }));

    indexedColors.sort((a, b) => b.count - a.count);

    return indexedColors;
}

// 颜色距离计算
function colorDistance(color1, color2) {
    const dr = color1.r - color2.r;
    const dg = color1.g - color2.g;
    const db = color1.b - color2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

// RGB转HEX
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// RGB转HSL
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

// 获取所有唯一颜色（去除相似颜色）
function getAllUniqueColors(colors, maxColors) {
    if (colors.length === 0) return [];

    // 首先对颜色进行去重和合并相似颜色
    const uniqueColors = [];
    const minDistance = 30; // 最小颜色距离

    for (const color of colors) {
        let isSimilar = false;

        for (const existing of uniqueColors) {
            const dist = colorDistance(color, existing);
            if (dist < minDistance) {
                isSimilar = true;
                break;
            }
        }

        if (!isSimilar) {
            uniqueColors.push(color);
        }
    }

    // 如果唯一颜色数量超过最大值，按出现频率排序并取前maxColors个
    if (uniqueColors.length > maxColors) {
        // 统计每个颜色的出现频率
        const colorCounts = new Map();
        for (const color of colors) {
            // 找到最接近的唯一颜色
            let closestColor = null;
            let minDist = Infinity;

            for (const unique of uniqueColors) {
                const dist = colorDistance(color, unique);
                if (dist < minDist) {
                    minDist = dist;
                    closestColor = unique;
                }
            }

            if (closestColor) {
                const key = `${closestColor.r},${closestColor.g},${closestColor.b}`;
                colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
            }
        }

        // 按频率排序并返回前maxColors个
        return uniqueColors
            .map(color => ({
                ...color,
                count: colorCounts.get(`${color.r},${color.g},${color.b}`) || 0
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, maxColors);
    }

    return uniqueColors.map(color => ({
        ...color,
        count: 0
    }));
}

// 显示色卡
function displayPalette(colors) {
    colorPalette.innerHTML = '';

    colors.forEach(color => {
        const hex = rgbToHex(color.r, color.g, color.b);
        const hsl = rgbToHsl(color.r, color.g, color.b);

        const colorCard = document.createElement('div');
        colorCard.className = 'color-card';

        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = hex;

        const info = document.createElement('div');
        info.className = 'color-info';

        info.innerHTML = `
            <h3>颜色 #${colors.indexOf(color) + 1}</h3>
            <div class="color-values">
                <span>HEX: ${hex.toUpperCase()}</span>
                <span>RGB: ${color.r}, ${color.g}, ${color.b}</span>
                <span>HSL: ${hsl.h}°, ${hsl.s}%, ${hsl.l}%</span>
            </div>
            <button class="copy-btn" onclick="copyToClipboard('${hex}')">复制色号</button>
        `;

        colorCard.appendChild(swatch);
        colorCard.appendChild(info);
        colorPalette.appendChild(colorCard);
    });

    paletteSection.style.display = 'block';
}

// 复制色号到剪贴板
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // 创建临时提示
        const toast = document.createElement('div');
        toast.textContent = `已复制: ${text.toUpperCase()}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    });
}

// 下载色卡
downloadBtn.addEventListener('click', () => {
    if (extractedColors.length === 0) return;

    const paletteCanvas = document.createElement('canvas');
    const cardWidth = 200;
    const cardHeight = 280;
    const cols = Math.min(4, extractedColors.length);
    const rows = Math.ceil(extractedColors.length / cols);

    paletteCanvas.width = cols * cardWidth + 20;
    paletteCanvas.height = rows * cardHeight + 60;

    const ctx = paletteCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, paletteCanvas.width, paletteCanvas.height);

    // 添加标题
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('配色色卡', paletteCanvas.width / 2, 40);

    extractedColors.forEach((color, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * cardWidth + 10;
        const y = row * cardHeight + 50;

        const hex = rgbToHex(color.r, color.g, color.b);

        // 绘制色块
        ctx.fillStyle = hex;
        ctx.fillRect(x, y, cardWidth - 10, 120);

        // 绘制色号信息
        ctx.fillStyle = '#333333';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`HEX: ${hex.toUpperCase()}`, x + 10, y + 140);
        ctx.fillText(`RGB: ${color.r}, ${color.g}, ${color.b}`, x + 10, y + 160);

        const hsl = rgbToHsl(color.r, color.g, color.b);
        ctx.fillText(`HSL: ${hsl.h}°, ${hsl.s}%, ${hsl.l}%`, x + 10, y + 180);
    });

    // 下载图片
    const link = document.createElement('a');
    link.download = 'color-palette.png';
    link.href = paletteCanvas.toDataURL('image/png');
    link.click();
});

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes fadeOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
`;
document.head.appendChild(style);