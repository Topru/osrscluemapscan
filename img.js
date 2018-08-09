const templateFolder = './templates/';
const imgFolder = './images/'
const cv = require('opencv4nodejs');
const fs = require('fs');
const linspace = require('linspace');
const request = require('request').defaults({ encoding: null });
const Jimp = require('jimp');

const matchImage = async (tempFile, image) => {
  return new Promise((resolve, reject) => {
    cv.imreadAsync(templateFolder+tempFile, (err, img) => {
      let template = img;
      template = template.bgrToGray();
      template = template.canny(50, 200);
      let tW = template.sizes[1];
      let tH = template.sizes[0];
      found = false;
      const cImage = image.copy();
      const gray = cImage.bgrToGray();
      linspace(1.2, 0.2, 40).forEach(scale => {
        const resized = image.rescale(scale);
        let r = gray.sizes[1] / resized.sizes[1];

        if(resized.sizes[1] < tW || resized.sizes[0] < tH) {
          return;
        }
        const edged = resized.canny(50, 200);
        const result = edged.matchTemplate(template, cv.TM_CCOEFF);
        const minMax = result.minMaxLoc();
        const maxVal = minMax.maxVal;
        const maxLoc = minMax.maxLoc;
        if(found === false || maxVal > found[0]) {
          found = [maxVal, maxLoc, r, scale];
        }

      });
      const [_, maxLoc, r, scale] = found;
      const startX = maxLoc.x * r;
      const startY = maxLoc.y * r;
      const endX = (maxLoc.x + tW) * r;
      const endY = (maxLoc.y + tH) * r;

      cImage.drawRectangle(
        new cv.Rect(startX, startY, tW * r, tH * r),
        new cv.Vec(0, 255, 0),
        2,
        cv.LINE_8
      );
      const resObj = {
        value: found[0],
        name: tempFile
      };
      cv.imwrite('./test/' + tempFile + '.png', cImage);
      resolve(resObj);
    });
  })
}
const matchImages = async (image) => {
  const results = [];
  const templates = fs.readdirSync(templateFolder);
  for(let template of templates) {
    let result = matchImage(template, image);
    results.push(result);
  }
  return results;
}

const uri = process.argv[2];
request.get(uri, function(err, res, body){
  Jimp.read(new Buffer(body), async (err, img) => {
    const base64 = await img.getBase64Async(Jimp.MIME_PNG);
    const image = await cv.imdecodeAsync(new Buffer(base64.split(',')[1], 'base64'));
    matchImages(image).then(promises => 
      Promise.all(promises).then(results =>  {
        results.sort((a, b) => a.value - b.value)
        console.log(results)
      })
    );
  })
})