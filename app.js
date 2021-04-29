const Nightmare = require('nightmare')
const cheerio = require('cheerio')
const vo = require('vo')

const queryString = require('query-string');
const ObjectsToCsv = require('objects-to-csv');
const requiredProducts = 100;

const divProductList = `div[data-testid='lstCL2ProductList']`;
// const divProductDesc = `div[data-testid='lblPDPDescriptionProduk']`;
const userAgent = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36';

const doCraw = function* () {
  let page = 1;
  const result = new Array();



  while (requiredProducts > result.length) {
    const nightmare = Nightmare({ show: false });
    let url = `https://www.tokopedia.com/p/handphone-tablet/handphone?page=${page}`;
    console.log(url)
    yield nightmare.useragent(userAgent).goto(url).wait(divProductList)
    let previousHeight = 0;
    let currentHeight = yield nightmare.evaluate(() => document.body.scrollHeight)

    while (previousHeight !== currentHeight) {
      previousHeight = currentHeight;
      currentHeight = yield nightmare.evaluate(() => document.body.scrollHeight);
      yield nightmare.scrollTo(currentHeight, 0)
    }

    yield nightmare.evaluate(() => document.querySelector('body').innerHTML)
      .then(html => result.push(...proceedHtml(html)))

    yield nightmare.end()
    page++;
  }

  for (let index = 0; index < result.length; index++) {
    const descUrl = result[index].descLink;

    if (descUrl) {
      const nightmareDesc = Nightmare({ show: false })
      yield nightmareDesc.useragent(userAgent).goto(descUrl).wait(2000)
      const description = yield nightmareDesc.evaluate(() => document.querySelector("div[data-testid='lblPDPDescriptionProduk']").textContent)
      result[index]['description'] = description;
      yield nightmareDesc.end()
    }
    delete result[index].descLink;
  }

  return result;

};

function proceedHtml(html) {
  const products = new Array();
  const $ = cheerio.load(html)
  $(divProductList).contents().each(function (i, elem) {
    const temp = {};
    const child = $("a", elem);
    const productWrap = child.find('div[data-testid="divProductWrapper"]');
    temp['imageLink'] = productWrap.find('img').attr('src');

    if (!temp['imageLink'].includes('data:image/png;base64')) {
      const productInfo = productWrap.children(':last-child')
      temp['productName'] = productInfo.children('span').text()
      temp['price'] = productInfo.find('.css-o5uqvq').text()
      temp['storeName'] = productInfo.find('.css-vbihp9').children(':last-child').text()
      let stars = 0;

      const imageStars = productInfo.children('.css-153qjw7').children().first().children()

      for (let index = 0; index < imageStars.length; index++) {
        const datum = imageStars[index].attribs.src;
        if (datum && datum.includes('4fede911')) {
          stars++;
        }
      }
      temp['stars'] = stars;

      const descHref = child.attr('href');
      const query = descHref.split('?')[1];
      const queryParsed = queryString.parse(query);
      let descLink = '';
      for (const keyQuery in queryParsed) {
        if (queryParsed[keyQuery].includes('http')) {
          descLink = queryParsed[keyQuery]
          break;
        }
      }
      temp['descLink'] = descLink ? descLink : descHref

      products.push(temp)
    }

  })

  return products;

}

vo(doCraw)(async function (err, data) {
  if (!err) {

    const csv = new ObjectsToCsv(data);
    await csv.toDisk('./tokopedia-products.csv');
    console.log(await csv.toString());
  } else {
    console.log('some error happens :', err)
  }
})