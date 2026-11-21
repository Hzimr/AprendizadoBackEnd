const productService = require("../services/productService");

async function search(req, res, next) {
  try {
    const result = await productService.search(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const product = await productService.getById(req.params.id);
    return res.status(200).json(product);
  } catch (error) {
    return next(error);
  }
}

module.exports = { search, getById };
