module.exports = async (req, res, manifest) => {
  const dog = await manifest.from('dogs').create(req.body)

  res.json(dog)
}
