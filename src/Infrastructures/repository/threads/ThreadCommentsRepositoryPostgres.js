/* eslint-disable no-unused-vars */
const { Pool } = require('pg')
const { nanoid } = require('nanoid')

const AuthorizationError = require('../../../Common/exceptions/AuthorizationError')
const NotFoundError = require('../../../Common/exceptions/NotFoundError')

const ThreadCommentsRepository = require('../../../Domains/threads/comments/ThreadCommentsRepository')

const AddedComment = require('../../../Domains/threads/comments/entities/AddedComment')
const Comment = require('../../../Domains/threads/comments/entities/Comment')

class ThreadCommentsRepositoryPostgres extends ThreadCommentsRepository {
  /**
   * @param {Pool} pool
   * @param {nanoid} idGenerator
   */
  constructor (pool, idGenerator) {
    super()

    this.#pool = pool
    this.#idGenerator = idGenerator
  }

  #pool
  #idGenerator

  async addCommentToThread (threadId, { content }, owner) {
    const id = `comment-${this.#idGenerator()}`

    const query = {
      text: `INSERT INTO thread_comments VALUES(
        $1, $2, $3, $4
      ) RETURNING id, content, owner`,
      values: [id, threadId, content, owner]
    }
    const { rows } = await this.#pool.query(query)

    return new AddedComment({ ...rows[0] })
  }

  async verifyCommentAccess (commentId, userId) {
    const query = {
      text: 'SELECT owner FROM thread_comments WHERE id = $1',
      values: [commentId]
    }
    const { rows, rowCount } = await this.#pool.query(query)

    if (!rowCount) throw new NotFoundError('komentar tidak ditemukan')

    if (rows[0].owner !== userId) throw new AuthorizationError('anda tidak dapat mengakses komentar orang lain')
  }

  async softDeleteCommentById (commentId, userId) {
    await this.verifyCommentAccess(commentId, userId)

    const query = {
      text: `
        UPDATE thread_comments SET is_deleted = TRUE
        WHERE id = $1 RETURNING id
      `,
      values: [commentId]
    }
    await this.#pool.query(query)
  }

  async getCommentsFromThread (threadId) {
    const query = {
      text: `
        SELECT 
          thread_comments.id, users.username, 
          thread_comments.date, thread_comments.content, 
          thread_comments.is_deleted AS "isDeleted"
        FROM thread_comments 
        LEFT JOIN users ON thread_comments.owner = users.id
        WHERE thread_id = $1
        GROUP BY thread_comments.id, users.username
        ORDER BY date
      `,
      values: [threadId]
    }
    const { rows, rowCount } = await this.#pool.query(query)

    if (!rowCount) return []

    return rows.map((val) => new Comment(val))
  }

  async verifyCommentLocation (commentId, threadId) {
    const query = {
      text: `
        SELECT thread_id AS "threadId" FROM thread_comments
        WHERE id = $1
      `,
      values: [commentId]
    }
    const { rows, rowCount } = await this.#pool.query(query)

    if (!rowCount) throw new NotFoundError('komentar tidak ditemukan')

    if (rows[0].threadId !== threadId) throw new NotFoundError('komentar tidak ditemukan pada thread ini')
  }
}

module.exports = ThreadCommentsRepositoryPostgres
