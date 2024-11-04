const { ObjectId } = require('mongodb');

class Users {
  constructor(db) {
    this.collection = db.collection('users');
  }

  async findAll() {
    return await this.collection.find().toArray();
  }

  async findOne(id) {
    return await this.collection.findOne({ _id: new ObjectId(id) });
  }

  async create(data) {
    const result = await this.collection.insertOne(data);
    return this.findOne(result.insertedId);
  }

  async update(id, data) {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: data }
    );
    return this.findOne(id);
  }

  async delete(id) {
    await this.collection.deleteOne({ _id: new ObjectId(id) });
  }
}

module.exports = Users;
