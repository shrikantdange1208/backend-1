module.exports = function formatDate(data) {
    data['createdDate'] = data['createdDate'].toDate()
    data['lastUpdatedDate'] = data['lastUpdatedDate'].toDate()
    return data
}