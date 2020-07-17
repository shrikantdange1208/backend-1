const capitalize = function (string) {
    return string
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

const formatDate = function (data) {
    data['createdDate'] = data['createdDate'].toDate()
    data['lastUpdatedDate'] = data['lastUpdatedDate'].toDate()
    return data
}

const getPrevDate = function (date) {
    var newDate = new Date(date)
    newDate.setDate(newDate.getDate() - 1)
    return newDate
}

const getNextDate = function (date) {
    var newDate = new Date(date)
    newDate.setDate(newDate.getDate() + 1)
    return newDate
}


const hasPreviousPage = async function (transactionCollection, snapshot){
    var initialtransaction = snapshot.docs[0]
    transactionCollection = transactionCollection
                            .endBefore(initialtransaction)
                            .limitToLast(constants.PAGE_SIZE)
    let prevPageSnapshot = await transactionCollection.get()
    hasPrevPage = (prevPageSnapshot.docs.length>0)
    return new Promise((resolve,reject) => {
        resolve(hasPrevPage)
    });
}
const hasNextPage = async function (transactionCollection, snapshot){
    var size = snapshot.docs.length
    var lasttransaction = snapshot.docs[size-1]
    transactionCollection = transactionCollection
                            .startAfter(lasttransaction)
                            .limit(constants.PAGE_SIZE)
    let nextPageSnapshot = await transactionCollection.get()
    hasNxtPage = (nextPageSnapshot.docs.length>0)
    return new Promise((resolve,reject) => {
        resolve(hasNxtPage)
    });
}

module.exports = {
    capitalize: capitalize,
    formatDate: formatDate,
    hasPreviousPage: hasPreviousPage,
    hasNextPage: hasNextPage,
    formatDate: formatDate,
    prevDate: getPrevDate,
    nextDate: getNextDate
}